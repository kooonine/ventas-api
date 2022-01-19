import { Order, ResultCode, LockType, Status, UserWalletHistoryType, ReadPref } from "../models";
import { LogUtil, ServerUtil, DecimalUtil } from "../lib";
import { UserService } from "./user.service";
import { UserWalletService } from "./user.wallet.service";
import { OrderCollection, TradeCollection, UserInfoHistoryCollection } from "../collections";
import { TradeService } from "./trade.service";
import { CompanyAssetService } from "./companyasset.service";
import { FiatrateService } from "./fiatrate.service";
import { DailyFiatService } from "./daily.fiat.service";
import { OrderHistoryService } from "./order.history.service";
import { VentasActionService } from "./ventasaction.service";
import { UserInfoHistoryService } from "./user.info.history.service";
import { FCMService } from "./fcm.service";



export class _OrderService {

    // 주문 생성
    // receivedOrder {type: string, kind: string, src: string, target: string, price: number, amount: number, userId: string}
    public async createOrder(receivedOrder: any) {
        // order 변수 초기화
        let order = await OrderService.initOrderValues(receivedOrder);
        if (!order) {
            LogUtil.error({ e: 'createOrder(): invalid param.', order });
            return { code: ResultCode.ERROR, msg: '주문 신청에 실패하였습니다.' }
        }

        // 0. 자원 잠금 및 동기처리에 사용할 변수 선언.
        let orderLock;        
        let result;
        let isTrade = false;

        try {
            // 동일 사용자가 1초 이내에 여러 주문을 시도할 수 없다.
            let userOrderLock = await ServerUtil.getLock(LockType.order, receivedOrder.userId, 5000);
            setTimeout(() => {
                if (userOrderLock) userOrderLock.unlock();
            }, 1000)

            
            // 주문 가능 금액 검사.
            let isEnoughAvailable;
            
            let tradeCost =  DecimalUtil.mul(order.amount, order.price , true);
            let makerFee = DecimalUtil.mul(tradeCost, order.ownerFee , true);       
            
            if (order.kind == "buy") {  // 매수 일 때                
                isEnoughAvailable = UserWalletService.isEnoughAvailable(order.owner, order.src, DecimalUtil.add(tradeCost, makerFee,true));
            } else if (order.kind == "sell") {  // 매도 일 때
                isEnoughAvailable = UserWalletService.isEnoughAvailable(order.owner, order.target, order.amount);
            }
            
            if (!isEnoughAvailable) {
                LogUtil.error({ e: 'createOrder(): 주문 가능 금액이 모자랍니다.', order });
                return { code: ResultCode.ERROR, msg: '주문 신청에 실패하였습니다.' }
            }

            orderLock = await ServerUtil.getLock(LockType.order, order.src + order.target, 5000);

            // 등록되어 있는 주문건 20개를 검색한다.
            for (let i = 0; i < 1000; i++) {

                /** 
                * 내가 등록하려는 가격에 이미 등록되어있는 order 검색. 
                * 검색해야하는 order kind는 등록하려는 order kind와 반대여야 한다. buy <-> sell                
                */
                let storedOrder;
                if (order.kind == 'buy' && order.type == 'limit') {
                    storedOrder = await this.getStoredOrder('sell', order.src, order.target, order.price);
                } else if (order.kind == 'sell' && order.type == 'limit') {
                    storedOrder = await this.getStoredOrder('buy', order.src, order.target, order.price);
                }

                if (!storedOrder) {
                    break;
                }

                // 4. 검색한 order 상태값 변경. (status == 20)
                result = await this.setStatus(storedOrder._id, Status.NONE, Status.ING);
                if (!result || result.code != 200) {                    
                    continue;
                }

                // 5. trade 생성.
                result = await TradeService.createTrade(storedOrder, order);
                if (result.code != 200 || !result.trade) {
                    LogUtil.error({ e: 'createOrder(): createTrade is failed. ' });
                    continue;
                }
                let trade = result.trade;

                // 6. order, storedOrder amount 동기화.   
                order.amount = DecimalUtil.sub(order.amount, trade.amount);
                storedOrder.amount = DecimalUtil.sub(storedOrder.amount, trade.amount);
                result = await this.setOrderAmount(storedOrder._id, storedOrder.amount);
                if (!result || result.code != 200) {
                    LogUtil.error({ e: 'createOrder(): setOrderAmount is failed. ', _id: storedOrder._id, amount: storedOrder.amount });
                    return { code: ResultCode.ERROR }
                }

                // 8. trade status 변경. (status = 20)
                result = await TradeService.setStatus(trade._id, Status.NONE, Status.ING);
                if (!result || result.code != 200) {
                    LogUtil.error({ e: 'createOrder(): setStatus is failed. ', _id: trade._id, prevStatus: Status.NONE, status: Status.ING });
                    return { code: ResultCode.ERROR }
                }

                // 9. wallet 동기화.                
                result = await UserWalletService.tradeCoin(trade);
                if (result.code != 200) {
                    return { code: ResultCode.ERROR }
                }

                // 10. trade status 변경. (status = 60)
                TradeService.setStatus(trade._id, Status.ING, Status.COMPLETE);
                
                // 알람이 가야할 경우 알람을 보내줌
                FCMService.pushTradeAlert(trade);

                if (storedOrder.amount == 0) {
                    result = await this.closeOrder(storedOrder);
                } else {
                    result = await this.setStatus(storedOrder._id, Status.ING, Status.NONE);
                }

                isTrade = true;

                if (result.code != 200) {
                    return { code: ResultCode.ERROR }
                }
              
                // 14. 요구 수량만큼 거래가 끝났을 경우 종료.             
                if (order.amount == 0) {                    
                    return { code: ResultCode.SUC }
                }

            }

            // 17. 주문 가능 금액 검사.
            let walletLedgerInfo;
            tradeCost = DecimalUtil.mul(order.amount, order.price, true);            
            makerFee = DecimalUtil.mul(tradeCost, order.ownerFee, true);

            if (order.kind == "buy") {                
                isEnoughAvailable = UserWalletService.isEnoughAvailable(order.owner, order.src, DecimalUtil.add(tradeCost, makerFee , true));
            } else if (order.kind == "sell") {
                isEnoughAvailable = UserWalletService.isEnoughAvailable(order.owner, order.target, order.amount);
            }

            if (!isEnoughAvailable) {
                LogUtil.error({ e: 'createOrder(): 주문 가능 금액이 모자랍니다.', order });
                return { code: ResultCode.ERROR, msg: '주문 신청에 실패하였습니다.' }
            }

            // 18. available 차감.
            let walletLedger = UserWalletService.initWalletLedger({
                owner: order.owner,
                assetCode: order.kind == 'buy' ? order.src : order.target,
                balance: 0,
                available: order.kind == 'buy' ? -DecimalUtil.add(tradeCost, makerFee, true) : -order.amount
            });
            result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.order , order.src  );
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createOrder(): available 차감 실패.', order, walletLedgerInfo });
                return { code: ResultCode.ERROR }
            }

            // 19. 더이상 storedOrder가 없다면 남은 수량으로 order 생성.             
            result = await this.insertOrder(order);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'createOrder(): 주문 생성 실패.', order });
                return { code: ResultCode.ERROR }
            }
        }
        catch (error) {
            LogUtil.error({ e: 'createOrder(): ' + error.message });
            return { code: ResultCode.ERROR, msg: '주문 신청에 실패하였습니다.' };
        }
        finally {
            if (orderLock) orderLock.unlock();
            VentasActionService.detectOrder(order, isTrade);
        }

        return { code: ResultCode.SUC };
    }

    private async insertOrder(order: Order) {
        if (!order) {
            LogUtil.error({ e: 'initOrder(): invalid param.', order });
            return { code: ResultCode.ERROR };
        }

        try {
            let result = await OrderCollection.insert(order).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'order 생성 실패.', order });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: 'insertOrder(): ' + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }

    /**
    * @param receivedOrder {type: string, kind: string, src: string, target: string, price: number, amount: number, userId: string}
    */
    private async initOrderValues(receivedOrder: any) {
        if (!receivedOrder
            || !receivedOrder.type || (receivedOrder.type != 'market' && receivedOrder.type != 'limit')
            || !receivedOrder.kind || (receivedOrder.kind != 'sell' && receivedOrder.kind != 'buy')
            || !Number(receivedOrder.amount) || Number(receivedOrder.amount) < 0 || Number(receivedOrder.amount) > 10000000000
            || !Number(receivedOrder.price) || Number(receivedOrder.price) < 0 || Number(receivedOrder.price) > 10000000000
            || !receivedOrder.src || !receivedOrder.target || !receivedOrder.userId) {

            LogUtil.error({ e: 'initOrderValues(): param is undefined. ', receivedOrder });
            return undefined;
        }
        let orderMakerFee = 0.001;
        if(receivedOrder.country == 'cn'){
            orderMakerFee = 0.002;
        }

        let order = {
            'type': receivedOrder.type,
            'owner': receivedOrder.userId,
            'kind': receivedOrder.kind,
            'src': receivedOrder.src,
            'target': receivedOrder.target,
            'price': DecimalUtil.floorDecimalPoint(Number(receivedOrder.price), 8),
            'initAmount': DecimalUtil.floorDecimalPoint(Number(receivedOrder.amount), 8),
            'amount': DecimalUtil.floorDecimalPoint(Number(receivedOrder.amount), 8),
            'ownerFee': 0,
            'makerFee': orderMakerFee,
            'status': 0,
            'oId': 'o' + ServerUtil.getKoTimeString(),
            'country' : receivedOrder.country
        };

        // 사용자 fee 계산
        order.ownerFee = await this.getOwnerFee(order.owner, order.makerFee, order.target);

        LogUtil.info({ i: 'initOrder', order }, true);

        return order;
    }

    private async getOwnerFee(owner: string, makerFee: number, target: string) {
        if (!owner || !Number(makerFee) || !target) {
            LogUtil.error({ e: "getOwnerFee(): param is undefined. ", owner, makerFee, target });
            return 0;
        }

        try {
            let user = UserService.getUserById(owner);

            if (!user || !user.profile.fee || !user.profile.fee[target]) {
                return makerFee;
            }

            let userTargetFee = user.profile.fee[target];

            if (!userTargetFee.expiredDt || userTargetFee.expiredDt.getTime() > new Date().getTime()) {
                return Number(userTargetFee.fee);
            }

        } catch (err) {
            LogUtil.error({ e: 'getOwnerFee(): ' + err.message, owner, makerFee, target });
            return makerFee;
        }

        return makerFee;
    }

    async getStoredOrder(kind: string, src: string, target: string, price: number) {
        if (!kind || !src || !target || !Number(price)) {
            LogUtil.error({ e: 'getStoredOrder(): param is undefined.', kind, src, target, price })
            return undefined;
        }

        let storedOrder;
        try {
            if (kind == 'buy') {
                storedOrder = OrderCollection.findOne({ 'kind': kind, 'src': src, 'target': target, 'price': { $gte: price }, 'amount': { $gt: 0 }, 'status': 0 }, { sort: { price: -1 } });
            }
            else if (kind == 'sell') {
                storedOrder = OrderCollection.findOne({ 'kind': kind, 'src': src, 'target': target, 'price': { $lte: price }, 'amount': { $gt: 0 }, 'status': 0 }, { sort: { price: 1 } });
            }
        } catch (err) {
            LogUtil.error({ e: 'getStoredOrder(): ' + err.message, kind, src, target, price })
            return undefined;
        }

        return storedOrder;
    }

    private async setStatus(_id: string, prevStatus: Status, status: Status) {
        if (!_id) {
            LogUtil.error({ e: 'setStatus(): param is undefined. ', _id, prevStatus, status });
            return { code: ResultCode.ERROR };
        }

        try {
            let result = await OrderCollection.update({ '_id': _id, status: prevStatus }, { $set: { 'status': status } }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: "setStatus(): update status is failed.", _id, prevStatus, status });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'setStatus(): ' + err.message, _id, prevStatus, status });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    private async setOrderAmount(_id: string, amount: number) {
        if (!_id || (!Number(amount) && Number(amount) != 0)) {
            LogUtil.error({ e: 'setOrderAmount(): param is undefined.', _id, amount });
            return { code: ResultCode.ERROR }
        }

        try {
            let result = await OrderCollection.update({ '_id': _id }, { $set: { 'amount': amount } }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: "setOrderAmount(): update amount is failed.", _id, amount });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'setOrderAmount():' + err.message, _id, amount });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    private async closeOrder(order: Order) {
        if (!order || !order._id) {
            LogUtil.error({ e: 'closeOrder(): orderId is undefined.', order });
            return { code: ResultCode.ERROR }
        }

        let result;
        try {
            result = await this.setStatus(order._id, Status.ING, Status.COMPLETE);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'closeOrder(): setOrderStatus is failed. ', result });
                return { code: ResultCode.ERROR }
            }

            order.status = Status.COMPLETE;
            order.upDt = new Date();
            OrderHistoryService.insertOrderHistory(order);
        } catch (err) {
            LogUtil.error({ e: 'closeOrder(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    private async getOrderById(_id: string) {
        if (!_id) {
            LogUtil.error({ e: 'getOrderById(): param is undefined.' });
            return undefined;
        }

        let order;
        try {
            order = OrderCollection.findOne({ _id: _id });
        } catch (err) {
            LogUtil.error({ e: 'getOrderById(): ' + err.message, _id });
            return undefined;
        }

        return order;
    }

    public async cancelOrder(_id: string, amount: number) {
        if (!_id || !Number(amount) || Number(amount) < 0) {
            LogUtil.error({ e: 'cancelOrder(): param is undefined.', _id, amount });
            return { 'code': ResultCode.ERROR_INVALID_PARAM, 'msg': '주문 취소 실패.' };
        }

        // 0. 자원 잠금 및 동기처리에 사용할 변수 선언.        
        let orderLock;
        
        try {
            // 2. 취소하려는 order를 가져온다.
            let storedOrder = await this.getOrderById(_id);

            // 1. storedOrder를 잠근다.
            orderLock = await ServerUtil.getLock(LockType.order, storedOrder.src + storedOrder.target, 5000);

            storedOrder = await this.getOrderById(_id);
            // 3. order status 유효 체크. (status가 0이 아니면 종료.)
            if (!storedOrder || storedOrder.status != Status.NONE) {
                LogUtil.error({ e: 'cancelOrder(): storedOrder is invalid.', orderId: _id, storedOrder });
                return { code: ResultCode.ERROR, msg: '주문 취소 실패.' };
            }

            // 4. 취소하려는 수량이 유효한지 체크.             
            if (storedOrder.amount < amount) {
                LogUtil.error({ e: 'cancelOrder(): amount is invalid. ', storedOrderAmount: storedOrder.amount, amount });
                return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 취소 실패.' }
            }

            // 5. storedOrder status를 진행중으로 변경 한다. (status = 20)
            let result = await this.setStatus(storedOrder._id, Status.NONE, Status.ING);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'cancelOrder(): setStatus is failed. ', storedOrderAmount: storedOrder.amount, amount });
                return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 취소 실패.' }
            }

            // 6. 취소하려는 수량만큼(전체가 될 수도 일부가 될 수도) initAmount, amount order에서 차감한다.
            storedOrder.initAmount = DecimalUtil.sub(storedOrder.initAmount, amount);
            storedOrder.amount = DecimalUtil.sub(storedOrder.amount, amount);

            // 7. 취소된 주문 수량 동기화.            
            result = await this.setOrderAmount(storedOrder._id, storedOrder.amount);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'cancelOrder(): setOrderAmount is failed. ', storedOrderAmount: storedOrder.amount, amount });
                return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 취소 실패.' }
            }

            result = await this.setOrderInitAmount(storedOrder._id, storedOrder.initAmount);
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'cancelOrder(): setOrderInitAmount is failed. ', storedOrderAmount: storedOrder.amount, amount });
                return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 취소 실패.' }
            }

            let tradeCost = DecimalUtil.mul(storedOrder.price, amount ,true);
            let makerFee = DecimalUtil.mul(tradeCost, storedOrder.ownerFee,true);

            // 8. available 추가
            let walletLedger = UserWalletService.initWalletLedger({
                owner: storedOrder.owner,
                assetCode: storedOrder.kind == 'buy' ? storedOrder.src : storedOrder.target,
                balance: 0,
                available: storedOrder.kind == 'buy' ? DecimalUtil.add(tradeCost, makerFee ) : amount
            });

            result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.order , storedOrder.src)
            if (!result || result.code != 200) {
                LogUtil.error({ e: 'cancelOrder(): updateBalance is failed.', walletLedger });
                return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 취소 실패.' }
            }

            // 13. storedOrder의 status를 변경한다. (status = 0, status = 60)
            if (storedOrder.amount == 0) {
                result = await this.closeOrder(storedOrder);
            } else {
                result = await this.setStatus(storedOrder._id, Status.ING, Status.NONE);
            }

            if (!result || result.code != 200) {
                LogUtil.error({ e: 'cancelOrder(): setOrderStatus is failed.', storedOrder });
                return { code: ResultCode.ERROR }
            }

            VentasActionService.detectOrder(storedOrder, false);

        } catch (error) {
            LogUtil.error({ e: 'cancelOrder(): ' + error.message });
            return { code: ResultCode.ERROR, msg: '주문 취소 실패.' };
        } finally {
            if (orderLock) { orderLock.unlock(); }
        }

        return { 'code': ResultCode.SUC, 'msg': '주문이 취소되었습니다.' };
    }

    private async setOrderInitAmount(id: string, initAmount: number) {
        if (!id || (!Number(initAmount) && Number(initAmount) != 0) || Number(initAmount) < 0) {
            LogUtil.error({ e: "setOrderInitAmount():파라미터 에러.", status, orderId: id });
            return { code: ResultCode.ERROR }
        }

        try {
            let result = OrderCollection.update({ '_id': id }, { $set: { 'initAmount': initAmount } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: "setOrderInitAmount():initAmount 동기화 실패.", status, orderId: id });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: "setOrderInitAmount():파라미터 에러.", status, orderId: id });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    public async modifyOrder(id: string, amount: number, price: number, userId: string) {
        if (!id || !Number(amount) || Number(amount) < 0 || !Number(price) || Number(price) < 0 || !userId) {
            LogUtil.error({ e: 'modifyOrder(): param is undefined. ' });
            return { code: ResultCode.ERROR, msg: '주문 정정 실패.' };
        }

        let result;
        // 1. 정정하려는 수량 취소.
        result = await this.cancelOrder(id, amount);
        if (result.code != 200) {
            LogUtil.error({ e: 'modifyOrder(): cancelOrder is failed.', result, id, amount, price, userId });
            return { code: ResultCode.ERROR, 'msg': '정정이 실패하였습니다.' }
        }

        let storedOrder = await this.getOrderById(id);
        if (!storedOrder) {
            LogUtil.error({ e: 'modifyOrder(): storedOrder is undefined.', id, amount, price, userId });
            return { code: ResultCode.ERROR, 'msg': '정정하려는 주문이 잘못되었습니다.' }
        }

        storedOrder.amount = amount;
        storedOrder.price = price;
        storedOrder.userId = userId;

        if (!CompanyAssetService.isTradePossible(storedOrder.src, storedOrder.target)) {
            LogUtil.error({ e: ' createOrder(can not trade)', storedOrder });
            return { code: ResultCode.ERROR }
        }

        return this.createOrder(storedOrder);
    }

    public async getMaxAmount(src: string, target: string) {
        if (!src || !target) {
            LogUtil.error({ e: 'getMaxAmount(): assetCode is undefined.' });
            return 0;
        }

        const orderTypeMax = [
            {
                $match: {
                    src: src, // 상위컴포넌트에서 파라미터값으로 받아와야함
                    target: target, // 상위컴포넌트에서 파라미터값으로 받아와야함                
                    status: 0
                },
            },
            {
                $group: {
                    _id: "$price",
                    totalAmount: { $sum: "$amount" }
                },
            },
            {
                $sort: {
                    totalAmount: -1, // sell: 1, buy: -1
                }
            },
            {
                $limit: 1,
            }
        ];

        let result;
        let maxCoinAmount = 1;
        try {
            result = await OrderCollection.rawCollection().aggregate(orderTypeMax).toArray();

            if (!result || !Array.isArray(result) || !result[0] || !result[0].totalAmount) {
                LogUtil.error({ messgae: ' getMaxAmount(): result is undefined. ', result });
                return 1;
            }

            maxCoinAmount = result[0].totalAmount;
        } catch (err) {
            LogUtil.error({ messgae: ' getMaxAmount(): ' + err.message, src, target });
            return 1;
        }

        return maxCoinAmount;
    }

    //미체결 내역
    public async noTradeList(owner : string, target : string, kind : string , limit : number){
        
        let result = [];

        if(!target || target == '코인/마켓 전체'){
            target = '';
        } else {
            target = target.split('/')[0];
        }

        switch (kind) {
            case '전체':
                kind = '';
                break;
            case '매수':
                kind = 'buy';
                break;
            case '매도':
                kind = 'sell';
                break;
        }
        
        try {
            result = await OrderCollection.find({owner : owner , status : 0 , target : { $regex : target, $options: 'i'}, kind : { $regex : kind, $options: 'i'} }, { sort : {inDt : -1} , limit : limit, readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: ' noTradeList(): ' + err.message, owner });
            return ;
        }
        return result;
    }
    // 미체결내역 (리뉴얼)
    public async notConcludedOrder(userId : string, market : string, target : string, kind : string, limit? : number){
        if(!userId){
            return [];
        }

        // 영어
        let engRex = /^[a-zA-Z]+$/;

        // 코인코드로 정규식을 통과못하면 '전체'로 인식.
        if(!engRex.test(market)){
            market = '';
        }

        if(!engRex.test(target)){
            target = '';
        }

        switch (kind) {
            case '전체':
                kind = '';
                break;
            case '매수':
                kind = 'buy';
                break;
            case '매도':
                kind = 'sell';
                break;
            case '全选':
                kind = '';
                break;
            case '买入':
                kind = 'buy';
                break;
            case '卖出':
                kind = 'sell';
                break;
        }

        let result;

        try {
            result = await OrderCollection.find({owner : userId , status : 0 ,
                src : {$regex : market, $options: 'i'}, target : { $regex : target, $options: 'i'}, kind : { $regex : kind, $options: 'i'} }, 
                { limit : limit, readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: ' notConcludedOrder(): ' + err.message });
            return [];
        }

        return result;
    }

    // 체결내역(리뉴얼) - 용량이 크기때문에 sort 조건을 걸지 않음.
    // public async concludedOrder(userId : string, market : string, target : string, kind : string, limit? : number){
    public async concludedOrder(userId : string){
        if(!userId){
            return [];
        }

        // // 영어
        // let engRex = /^[a-zA-Z]+$/;

        // // 코인코드로 정규식을 통과못하면 '전체'로 인식.
        // if(!engRex.test(market)){
        //     market = '';
        // }

        // if(!engRex.test(target)){
        //     target = '';
        // }

        // switch (kind) {
        //     case '全选':
        //         kind = '';
        //         break;
        //     case '买入':
        //         kind = 'buy';
        //         break;
        //     case '卖出':
        //         kind = 'sell';
        //         break;
        // }

        let result;

        // 3개월 이전것들만 보여줌.
        // let now = Date.now();
        // let maxDate = new Date(now-7776000000);

        try {

            // result = await TradeCollection.find({$or: [{ owner: userId }, { orderOwner: userId }] , status : 60 , inDt : {$gt : maxDate},
            //     src : {$regex : market, $options: 'i'}, target : { $regex : target, $options: 'i'}, kind : { $regex : kind, $options: 'i'} }, 
            //     { sort : { tId : -1 } , limit : limit , readPreference: ReadPref.SECONDARY_PREFERRED });
            let userHistory;
            userHistory =  await UserInfoHistoryCollection.findOneSecondary({_id :userId },{fields : {_id : 0, 'history.trade' : 1}});
            if(!userHistory.history.trade){
                return [];
            }
            result = userHistory.history.trade;
            
            // result = await TradeCollection.find({$or: [{ owner: userId }, { orderOwner: userId }] , status : 60 , inDt : {$gt : maxDate}
            //      }, 
            //     {  limit : limit , readPreference: ReadPref.SECONDARY_PREFERRED });

        } catch (err) {
            LogUtil.error({ e: ' oncludedOrder(): ' + err.message });
            return [];
        }

        return result;
    }

    // 사용자의 미체결 내역건 보유여부 확인 (회원탈퇴관련)
    public async checkZeroStatusOrder(_id : string){
        let zeroStatusOrder;
    
        let result = false;
        if(!_id){
            LogUtil.error({ e: 'checkZeroStatusOrder(): param is undefined.' });
            return result;
        }
    
        try {
            zeroStatusOrder = await OrderCollection.findOneSecondary({ owner : _id, status : 0 });
            
            if(!zeroStatusOrder){
                // 미체결 건이 없을때에만 0을 반환
                result = true;
            }
    
        } catch (err) {
            LogUtil.error({ e: 'checkZeroStatusOrder(): db exception.. ' + err.message });
            result = false;
            return result;
        }
        
        return result;
    }
}
export const OrderService = new _OrderService();