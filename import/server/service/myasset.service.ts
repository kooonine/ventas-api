import { LogUtil, DecimalUtil } from "../lib";
import { UserWalletCollection, CompanyAssetCollection, TradeCollection } from "../collections";
import { ReadPref } from "../models";

export class _MyassetService {
    async tradeList(target: string, kind: string, limit : number){
        let user = Meteor.userId();

        if (!user) {
            LogUtil.error({ e : 'tradeList(). not found User..' });
            return [];
        }

        if(!target || target == '코인/마켓 전체'){
            target = '';
        } else {
            target = target.split('/')[0];
        }

        try {
            let tradeList = [];
            let myTradeList = [];
            let kindText = "";
            let typeText = "";

            // 컬럼으로 코인이름을 넣기 위해 코인 리스트 생성.
            let coinNameList = {};
            let companyAssetList = await CompanyAssetCollection.find({}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            for (let i = 0; i < companyAssetList.length; i++) {
                coinNameList[companyAssetList[i].code] = companyAssetList[i].name;
            }

            tradeList = await TradeCollection.find({ $or: [{ owner: user }, { orderOwner: user }], status: 60, target : { $regex : target, $options: 'i'} }, { sort: { tId: -1 }, limit: limit, readPreference: ReadPref.SECONDARY_PREFERRED });

            // taker 체결 내역 추가.
            for (let i = 0; i < tradeList.length; i++) {

                if (tradeList[i].type == "limit") {
                    typeText = "지정가"
                } else {
                    typeText = "시장가"
                }

                if (tradeList[i].owner == user) {
                    let data = {
                        tId: tradeList[i].tId,
                        tDt: tradeList[i].inDt,
                        src: tradeList[i].src,
                        name: coinNameList[tradeList[i].target],
                        target: tradeList[i].target,
                        tradeGb: kindText,
                        type: typeText,
                        tradePrice: tradeList[i].price,
                        tradeTotalPrice:  DecimalUtil.floorDecimalPoint(tradeList[i].price * tradeList[i].amount,8),
                        fee:  DecimalUtil.floorDecimalPoint(tradeList[i].price * tradeList[i].amount * tradeList[i].ownerFee, 8),
                        amount: tradeList[i].amount,
                        selPrice: 0
                    }

                    if (tradeList[i].kind == "buy") {
                        data.tradeGb = "매수"
                        data.selPrice = DecimalUtil.floorDecimalPoint(data.tradeTotalPrice + data.fee, 8);
                    } else {
                        data.tradeGb = "매도"
                        data.selPrice = DecimalUtil.floorDecimalPoint(data.tradeTotalPrice - data.fee, 8);
                    }
                    if(kind == '매수'){
                        if(tradeList[i].owner == user && tradeList[i].kind == "buy" ){
                            myTradeList.push(data);        
                        }
                    }else if (kind == '매도'){
                        if(tradeList[i].owner == user && tradeList[i].kind == "sell" ){
                            myTradeList.push(data);        
                        }
                    }else {
                        myTradeList.push(data);
                    }
                }

                if (tradeList[i].orderOwner == user) {
                    let data = {
                        tId: tradeList[i].tId,
                        tDt: tradeList[i].inDt,
                        src: tradeList[i].src,
                        name: coinNameList[tradeList[i].target],
                        target: tradeList[i].target,
                        tradeGb: kindText,
                        type: typeText,
                        tradePrice: tradeList[i].price,
                        tradeTotalPrice: DecimalUtil.floorDecimalPoint(tradeList[i].price * tradeList[i].amount, 8),
                        fee: DecimalUtil.floorDecimalPoint(tradeList[i].price * tradeList[i].amount * tradeList[i].orderOwnerFee, 8),
                        amount: tradeList[i].amount,
                        selPrice: 0
                    }
                    if (tradeList[i].kind == "buy") {
                        data.tradeGb = "매도"
                        data.selPrice = DecimalUtil.floorDecimalPoint(data.tradeTotalPrice - data.fee, 8);
                    } else {
                        data.tradeGb = "매수"
                        data.selPrice = DecimalUtil.floorDecimalPoint(data.tradeTotalPrice + data.fee, 8);
                    }
                    if(kind == '매수'){
                        if(tradeList[i].orderOwner == user && tradeList[i].kind == "sell" ){
                            myTradeList.push(data);        
                        }
                    }else if (kind == '매도'){
                        if(tradeList[i].orderOwner == user && tradeList[i].kind == "buy" ){
                            myTradeList.push(data);        
                        }
                    }else {
                        myTradeList.push(data);
                    }
                }
            }
            
            let result = myTradeList.slice(0,limit);

            return result;
        } catch (err) {
            LogUtil.error({ e: 'tradeList(): ' + err.message });
            return [];
        }
    }
}
export const MyassetService = new _MyassetService();