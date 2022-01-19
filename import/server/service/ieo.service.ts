import { IEOListCollection } from "../collections/ieo.list.collection";
import { LogUtil, DecimalUtil } from "../lib";
import { ReadPref, IEOHistory, Status, ResultCode, UserWalletHistoryType } from "../models";
import { IEOHistoryCollection } from "../collections/ieo.history.collection";
import { UserWalletService } from "./user.wallet.service";

export class _IEOService {
    async getIEOList(code? : string, orderCount? : number){
        LogUtil.info({ console : 'getIEOList(). code : ' + code}, true);
        
        let result;

        try {
            if(!code){
                result = await IEOListCollection.find({}, { sort: { ieoNo : -1 }, readPreference : ReadPref.SECONDARY_PREFERRED });
            } else if(code) {
                if(!orderCount){
                    orderCount = 1;
                }

                result = await IEOListCollection.findOne({ orderCount : orderCount , 'basicInformation.code' : code}, {sort : { ieoNo : -1 }});
            }
        } catch (err) {
            LogUtil.error({ message : 'getIEOList() : exception. ', error : err.message });
            return [];
        }
        
        return result;
    }

    /* IEO 의 현재잔량 구하기 */
    async getIEOTotalTradingAmount(code : string){
        LogUtil.info({ console : 'getIEOTotalTradingAmount() . code : ' + code},  true);
        
        let totalTradingAmount = 0;

        let aggreateQuery = [
            {
                $project: {
                    status: 1,
                    amount: 1,
                    assetCode: 1
                }
            },
            {
                $match: {
                    status: 60,
                    assetCode: code
                }
            },
            {
                $group: {
                    _id: code,
                    amount: { $sum: "$amount" }
                }
            }
        ];

        // 1. 총 거래수량 구하기
        try {
            let ieoHistoryAmountSum = await IEOHistoryCollection.rawCollection().aggregate(aggreateQuery).toArray();
            if(!ieoHistoryAmountSum || ieoHistoryAmountSum.length == 0){
                LogUtil.error({ message: 'getIEOTotalTradingAmount(). ieo (' + code + ') trading history is null. '});
                return totalTradingAmount;
            }
            totalTradingAmount = ieoHistoryAmountSum[0].amount;
        } catch (err) {
            LogUtil.error({ message: 'getIEOTotalTradingAmount(). exception. case1. err : ' + err.message });
            return undefined;
        }
        
        return totalTradingAmount;
    }

    initIEOHistory(orderInfo : any, ieoInfo : any) {
        if (!orderInfo || !orderInfo.code
            || !Number(orderInfo.amount) || orderInfo.amount < 0
            || !orderInfo.userId) {
            LogUtil.error({ message: 'initIEOHistory(): Invalid Param (orderInfo). ', orderInfo });
            return undefined;
        }
        
        // amount, price, startDate/endDate 를 확인해야 함.
        if (!Number(ieoInfo.tradeInformation.initAmount) || ieoInfo.tradeInformation.initAmount < 0
            || !Number(ieoInfo.tradeInformation.initPrice) || ieoInfo.tradeInformation.initPrice < 0) {
            LogUtil.error({ message: 'initIEOHistory(): Invalid Param (ieoInfo). ', ieoInfo });
            return undefined;
        }

        // ieo 최소 매수 수량 확인.
        if (orderInfo.amount < ieoInfo.tradeInformation.initAmount) {
            LogUtil.error({ e: 'initIEOHistory(): ieo amount is lack.. ', 'orderInfo' : orderInfo, 'ieoInfo_initAmount : ' : ieoInfo.tradeInformation.initAmount });
            return undefined;
        }

        let price = ieoInfo.tradeInformation.initPrice;
        
        let ieoHistory: IEOHistory = {
            owner: orderInfo.userId,
            assetCode: orderInfo.code,
            amount: DecimalUtil.floorDecimalPoint(orderInfo.amount , 8),
            price: price,
            status: Status.NONE
        }

        return ieoHistory;
    }

    async insertIEOHistory(ieoHistory: IEOHistory) {
        if (!ieoHistory) {
            LogUtil.error({ e: 'insertIEOHistory(): Invalid Param.', ieoHistory });
            return { code: ResultCode.ERROR }
        }

        let result;

        try {
            result = await IEOHistoryCollection.insert(ieoHistory).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'insertIEOHistory(): To insert ieoHistory is failed.', ieoHistory });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'insertIEOHistory(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC, _id: result }
    }

    async buyIEOCoin(orderInfo : any, ieoInfo : any){
        // 유효성 검사
        LogUtil.info({ console: 'buyIEOCoin()' }, true);

        // orderInfo : 구매정보 , ieoInfo : 구매하려는 IEO 정보
        if(!orderInfo || !ieoInfo){
            LogUtil.error({ e : 'buyIEOCoin(): invalid Param. orderInfo / ieoInfo : ' + orderInfo + ' / ' + ieoInfo });
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }
        
        let userId = Meteor.userId();
        
        if(!userId){
            LogUtil.error({ e: 'buyIEOCoin(): user in undefined.' })
            return { code: ResultCode.ERROR };
        }

        orderInfo['userId'] = userId;

        // 0. 사용할 자원 선언.
        let result;

        // 1. ieoHistory 객체 유효성 검사 및 생성.
        let ieoHistory = this.initIEOHistory(orderInfo, ieoInfo);

        // 1_1. initIEOHistory 실패 시
        if(!ieoHistory) {
            return { code : ResultCode.ERROR };
        }

        // 2. ieoHistory status 0 으로 생성. (매수 대금 미지급 상태)
        result = await this.insertIEOHistory(ieoHistory);
        if (result.code != 200) {
            LogUtil.error({ e: 'buyIEOCoin(): To insert ieoHistory is failed.', ieoHistory });
            return { code: ResultCode.ERROR };
        }
        ieoHistory._id = result._id;

        // 3. 매수 대금 계산        
        let ledgerInfo = {
            owner: ieoHistory.owner,
            assetCode: 'KRW',
            balance: - DecimalUtil.mul(ieoHistory.price, ieoHistory.amount),
            available: - DecimalUtil.mul(ieoHistory.price, ieoHistory.amount)
        }
        let walletLedger = UserWalletService.initWalletLedger(ledgerInfo);
        
        // 3_1. initWalletLedger 실패 시
        if(!walletLedger) {
            return { code : ResultCode.ERROR };
        }

        // 4. KRW 지갑 자산 차감.
        result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.ieo , 'KRW');
        if (result.code != 200) {
            LogUtil.error({ e: 'buyIEOCoin(): To update Balance is failed.', walletLedger })
            return { code: ResultCode.ERROR };
        }

        /* // 5. IEOCoin 지갑이 있는지 확인. 
        let coinWallet = UserWalletService.getUserWallet(ieoHistory.assetCode, ieoHistory.owner);

        // 6. IEOCoin 지갑이 없다면 생성.
        if (!coinWallet) {
            coinWallet = UserWalletService.initValues(ieoHistory.assetCode, ieoHistory.owner);
            result = await UserWalletService.insertWallet(coinWallet);

            if (!result || result.code != 200) {
                LogUtil.error({ e: 'buyIEOCoin(): insertWallet is failed.', coinWallet })
                return { code: ResultCode.ERROR };
            }
        }

        // 7. IEOCoin 지갑 갯수 계산.
        ledgerInfo = {
            owner: ieoHistory.owner,
            assetCode: ieoHistory.assetCode,
            balance: parseFloat((ieoHistory.amount).toFixed(8)),
            available: parseFloat((ieoHistory.amount).toFixed(8))
        }
        walletLedger = UserWalletService.initWalletLedger(ledgerInfo);

        // 8. IEO Coin 지갑 자산 증가.
        result = await UserWalletService.updateBalance(walletLedger, UserWalletHistoryType.ieo);
        if (result.code != 200) {
            LogUtil.error({ e: 'buyIEOCoin(): To update Balance is failed.', walletLedger })
            return { code: ResultCode.ERROR };
        } */

        // 9. 모든 자산 이동이 끝난 후 statsu 60(완료)로 변경.
        this.updateStatus(ieoHistory._id, Status.COMPLETE);

        return { code: ResultCode.SUC }
    }

    async updateStatus(_id: string, status: Status) {
        if (!_id || !status) {
            LogUtil.error({ e: 'ieo updateStatus(): invalid param.', _id });
            return { code: ResultCode.ERROR }
        }

        let result;
        try {
            result = await IEOHistoryCollection.update({ _id: _id }, { $set: { status: status } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'ieo updateStatus(): To update status is failed.', _id });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'updateStatus(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }

    // 나의 IEO 구매내역
    async getMyIEOHistory(assetCode: string) {
        let userId = Meteor.userId();
        
        if (!userId || !assetCode) {
            LogUtil.error({ e: 'getMyIEOHistory(): param is undefined.', userId, assetCode });
            return [];
        }

        let ieoHistoryList = [];

        try {
            ieoHistoryList = await IEOHistoryCollection.find({ owner: userId, assetCode: assetCode, status: 60 }, { sort: { inDt: -1 }, readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: 'getMyIEOHistory(): ' + err.message });
            return [];
        }

        return ieoHistoryList;
    }
}

export const IEOService = new _IEOService();