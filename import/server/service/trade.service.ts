import { Order, ResultCode, Trade, Status } from "../models";
import { TradeCollection } from "../collections/trade.collection";
import { LogUtil, ServerUtil } from "../lib";
import { UserInfoHistoryService } from "./user.info.history.service";
import { CompanyAssetCollection } from "../collections";


export class _TradeService {
    public async createTrade(storedOrder: Order, order: Order) {
        let trade = this.initValues(storedOrder, order);
        if (!trade) {
            LogUtil.error({ e: 'createTrade(): trade is undefined. ' });
            return { code: ResultCode.ERROR };
        }

        let result;
        try {
            result = await TradeCollection.insert(trade).first().toPromise();

            if (!result) {
                LogUtil.error({ e: "createTrade(): insert has failed.", trade });
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: 'createTrade(): ' + err.message, trade });
            return { code: ResultCode.ERROR };
        }

        trade._id = result;
        return { code: ResultCode.SUC, trade: trade };
    }

    private initValues(storedOrder: Order, order: Order): Trade {
        if (!storedOrder || !storedOrder.owner || (!Number(storedOrder.ownerFee) && storedOrder.ownerFee != 0)
            || !Number(storedOrder.price) || !storedOrder.oId
            || !order || !order.type || !order.kind || !order.owner || !order.src || !order.target) {

            LogUtil.error({ e: 'initValues() : trade 초기화 실패.', storedOrder, order });
            return undefined;
        }

        let trade: Trade = {
            'orderOwner': storedOrder.owner,
            'orderOwnerCountry' : storedOrder.country,
            'orderOwnerFee': Number(storedOrder.ownerFee),
            'type': order.type,
            'kind': order.kind,
            'owner': order.owner,
            'ownerCountry' : order.country,
            'src': order.src,
            'target': order.target,
            'ownerFee': Number(order.ownerFee),
            'takerFee': 0.001,
            'price': Number(storedOrder.price),
            'amount': 0,
            'status': 0,
            'tId': 'T' + ServerUtil.getKoTimeString(),
            'oId': storedOrder.oId
        }
        trade.amount = this.getAmount(storedOrder, order);

        if(order.src != 'KRW'){
            trade.marketKRWPrice = this.getMarketKRWPrice(order.src);
        }

        LogUtil.info({ i: 'initTrade', trade }, true);

        return trade;
    }

    private getAmount(storedOrder: Order, order: Order) {
        if (order.amount - storedOrder.amount < 0) {
            return order.amount;
        } else {
            return storedOrder.amount;
        }
    }

    getMarketKRWPrice(src){
        let marketKRWPrice = 0;
        if (!src) {
            LogUtil.error({ e: "getMarketKRWPrice(): invalid param.", src });
            return marketKRWPrice;
        }

        try {
            let companyAsset = CompanyAssetCollection.findOne({ src:'KRW' , code : src } , {fields: { _id : 0, presentPrice : 1 }});
            if (!companyAsset || !companyAsset.presentPrice) {
                return marketKRWPrice;
            }
            marketKRWPrice = companyAsset.presentPrice;
        } catch (err) {
            LogUtil.error({ e: 'getMarketKRWPrice(): ' + err.message });
            return marketKRWPrice;
        }
        return marketKRWPrice;
    }

    public async setStatus(_id: string, prevStatus: Status, status: Status) {
        if (!_id) {
            LogUtil.error({ e: 'setStatus(): param is undefined. ', _id, prevStatus, status });
            return { code: ResultCode.ERROR };
        }

        try {
            
            let result = await TradeCollection.update({ '_id': _id, status: prevStatus }, { $set: { 'status': status } }).first().toPromise();
            
            if(status == 60){
                try {
                    await UserInfoHistoryService.setUserTrade(_id);
                } catch (error) {
                    LogUtil.error({ e: "setUserTrade(): setUserTrade failed.", _id, prevStatus, status });
                }
            }
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







}
export const TradeService = new _TradeService();