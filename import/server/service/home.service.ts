import { CompanyAssetCollection, UserWalletCollection, OrderCollection } from "../collections";
import { ReadPref, ResultCode } from "../models";
import { LogUtil } from "../lib/log.util";
import { FavoriteAssetCollection } from "../collections/favorite.asset.collection";
import { foreignApiCollection } from "../collections/foreignapi.collection";

//거래소
export class _HomeService{
    //메인
    async mainPage(country){
        let result;
        if(country == 'cn'){
            let coinCount  = await CompanyAssetCollection.rawCollection().distinct('code', {disPlayCN : true , useYn : true}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            let coinInfo = await CompanyAssetCollection.find({ useYn: true, disPlayCN : true, kind : 'coin' } , { readPreference: ReadPref.SECONDARY_PREFERRED });

            result = {coinCount :coinCount , list :  coinInfo};
            return result;
             
        }else{
            let coinCount  = await CompanyAssetCollection.rawCollection().distinct('code', {disPlayKR : true , useYn : true}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            let coinInfo = await CompanyAssetCollection.find({ useYn: true, disPlayKR : true, kind : 'coin' } , { readPreference: ReadPref.SECONDARY_PREFERRED });
            result = {coinCount :coinCount , list :  coinInfo};
            return result;
        }
    }

    CompanyAssetListCoin(country){
        LogUtil.info({ console: 'CompanyAssetListCoin' }, true);
        if(country == 'cn'){
            return CompanyAssetCollection.find({useYn: true, disPlayCN : true, kind : 'coin' } , { readPreference: ReadPref.SECONDARY_PREFERRED });
        }else{
            return CompanyAssetCollection.find({useYn: true, disPlayKR : true, kind : 'coin' } , { readPreference: ReadPref.SECONDARY_PREFERRED });
        }
    }
    
    CompanyAssetListALL(market){
        LogUtil.info({ console: 'CompanyAssetListALL' }, true);
        return CompanyAssetCollection.find({ } , { readPreference: ReadPref.SECONDARY_PREFERRED });
    }
    //코인리스트
    CompanyAssetList(market){
        LogUtil.info({ console: 'CompanyAssetList' }, true);
        return CompanyAssetCollection.find({ useYn: true, kind : 'coin' , src : market } , {sort : {dailyTradingValue:-1},  readPreference: ReadPref.SECONDARY_PREFERRED });
    }
    //선택 코인 정보 하이라이트
    coinDetail(market,target){
        LogUtil.info({ console: 'coinDetail' }, true);
        return CompanyAssetCollection.findOne({ useYn: true, src : market, code : target });
    }
    
    // 관심코인 리스트 (리뉴얼 전)
    async favoriteCoin(userId: string, keyword) {
        LogUtil.info({ console: 'favoriteCoin' }, true);
        let favoriteC = [];
        let coinList = [];
        let result = [];

        try {
            favoriteC = await FavoriteAssetCollection.find({ inUser: userId }, { sort: { sno: 1 }, readPreference: ReadPref.SECONDARY });
    
            for (let i = 0; i < favoriteC.length; i++) {
                result = await CompanyAssetCollection.find({ $and: [{ $or: [{ code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }] }, { code: favoriteC[i].code, src: favoriteC[i].src }] }, { sort: { dailyTradingValue: -1 }, readPreference: ReadPref.SECONDARY });
                if (result[0]) {
                    coinList.push(result[0]);
                }
            }
        } catch (err) {
            LogUtil.error({ e : 'favoriteCoin() : db exception.' + err.message });
            return [];
        }

        return coinList;
    }

    // 리뉴얼 (HK) 관심코인리스트
    async renewalFavoriteCoin(userId: string, keyword, src : string) {
        LogUtil.info({ console: 'renewalFavoriteCoin' }, true);
        let favoriteC = [];
        let coinList = [];
        let result = [];

        try {
            favoriteC = await FavoriteAssetCollection.find({ inUser: userId, src : src }, { sort: { sno: 1 }, readPreference: ReadPref.SECONDARY });
    
            for (let i = 0; i < favoriteC.length; i++) {
                result = await CompanyAssetCollection.find({ $and: [{ $or: [{ code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }] }, { code: favoriteC[i].code, src: favoriteC[i].src }] }, { sort: { dailyTradingValue: -1 }, readPreference: ReadPref.SECONDARY });
                if (result[0]) {
                    coinList.push(result[0]);
                }
            }
        } catch (err) {
            LogUtil.error({ e : 'renewalFavoriteCoin() : db exception.' + err.message });
            return [];
        }

        return coinList;
    }

    // 관심코인 추가
    async addFavorite(src : string, code : string, name : string, userId : string){
        LogUtil.info({ console : 'addFavorite' }, true);

        let result;

        if(!src || !code || !name || !userId){
            LogUtil.error({ e : 'addFavorite() : invalid param. src / code / name / userId : '+ src + ' / ' + code + ' / ' + name + ' / ' + userId });
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }

        let myFavoriteAsset = { src: src, code: code, sno: 0, name: name };
        let lastFavoriteAsset = FavoriteAssetCollection.findOne({ inUser: userId }, { sort: { sno: -1 } });

        if (lastFavoriteAsset) {
            myFavoriteAsset.sno = lastFavoriteAsset.sno + 1;
        }

        try {
            result = await FavoriteAssetCollection.insert(myFavoriteAsset).first().toPromise();
            
            if(!result){
                LogUtil.error({ e : 'addFavorite() : insert failed... no result.'});
                return { code : ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e : 'addFavorite() : insert failed... db exception.' + err.message });
            return { code : ResultCode.ERROR };
        }
        
        return { code : ResultCode.SUC };
    }
    // 관심코인 제거
    async removeFavorite(src : string, code : string, userId : string){
        LogUtil.info({ console: 'removeFavorite' }, true);
        
        let result;

        if(!src || !code || !userId){
            LogUtil.error({ e : 'removeFavorite() : invalid param. src / code / userId : '+ src + ' / ' + code + ' / ' + userId });
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }

        try {
            result = await FavoriteAssetCollection.remove({ src : src, code : code , inUser : userId }).first().toPromise();
            
            if(!result){
                LogUtil.error({ e : 'removeFavorite() : remove failed... no result.'});
                return { code : ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e : 'removeFavorite() : remove failed... db exception.' + err.message });
            return { code : ResultCode.ERROR };
        }
        
        return { code : ResultCode.SUC }
    }
    async isMyFavoriteCoin(src : string, code : string, userId : string){
        LogUtil.info({ console: 'isMyFavoriteCoin' }, true);

        let result;

        if(!src || !code || !userId){
            LogUtil.error({ e : 'isMyFavoriteCoin() : invalid param. src / code / userId : '+ src + ' / ' + code + ' / ' + userId });
            return { code : ResultCode.ERROR_INVALID_PARAM };
        };

        try {
            result = await FavoriteAssetCollection.findOneSecondary({ src : src , code : code , inUser : userId });
            
            if(!result){
                return { code : ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e : 'isMyFavoriteCoin() : remove failed... db exception.' + err.message });
            return { code : ResultCode.ERROR };
        }

        return { code : ResultCode.SUC };
    }
    async isMyPossesionCoin(code : string, userId : string){
        LogUtil.info({ console: 'isMyPossesionCoin' }, true);

        let result;

        if(!code || !userId){
            LogUtil.error({ e : 'isMyPossesionCoin() : invalid param. code / userId : '+ code + ' / ' + userId });
            return { code : ResultCode.ERROR_INVALID_PARAM };
        };

        try {
            result = await UserWalletCollection.findOneSecondary({ assetCode : code , owner : userId, balance: { $gt : 0 }});
            
            if(!result){
                return { code : ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e : 'isMyPossesionCoin() : remove failed... db exception.' + err.message });
            return { code : ResultCode.ERROR };
        }
        return { code : ResultCode.SUC };
    }
    
    // 보유코인 리스트
    async getMyCoinList(userId : string, keyword){
        LogUtil.info({ console: 'getMyCoinList' }, true);

        let result;
        
        let MyCoin = [];
        let coinList = [];

        if(!userId){
            LogUtil.error({ e : 'getMyCoinList() : invalid param.' });
            return [];
        }

        try {
            MyCoin = await UserWalletCollection.find({ owner : userId, kind : 'coin', balance: { $gt : 0 }}, { readPreference : ReadPref.SECONDARY });

            for (let i = 0; i < MyCoin.length; i++) {
                coinList.push(MyCoin[i].assetCode);
            }

            result = await CompanyAssetCollection.find({ $and: [{ $or: [{ code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }] }, { useYn: true, code: { $in: coinList } }] }, { sort: { dailyTradingValue: -1 }, readPreference: ReadPref.SECONDARY });
        } catch (err) {
            LogUtil.error({ e : 'getMyCoinList() : db exception.' + err.message });
            return [];
        }
        
        return result;
    }

    // 보유코인 리스트 (리뉴얼용)
    async getMyCoinListCode(userId : string){
        LogUtil.info({ console: 'getMyCoinListCode' }, true);

        let MyCoin = [];
        let coinList = [];

        if(!userId){
            LogUtil.error({ e : 'getMyCoinListCode() : invalid param.' });
            return [];
        }

        try {
            MyCoin = await UserWalletCollection.find({ owner : userId, kind : 'coin', balance: { $gt : 0 }}, { readPreference : ReadPref.SECONDARY });

            for (let i = 0; i < MyCoin.length; i++) {
                coinList.push(MyCoin[i].assetCode);
            }
        } catch (err) {
            LogUtil.error({ e : 'getMyCoinListCode() : db exception.' + err.message });
            return [];
        }
        
        return coinList;
    }

    async coinSearch(src : string, keyword : string){
        LogUtil.info({ console : 'coinSearch()' }, true);

        let result;

        try {
            result = await CompanyAssetCollection.find({ $and: [{ $or: [{ code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }] }, { "src": src }] }, { sort: { dailyTradingValue: -1 }, readPreference: ReadPref.SECONDARY });
        } catch (err) {
            LogUtil.error({ e : 'coinSearch() : db exception ' + err.message });
            return [];
        }

        return result;
    }

    //////////////////호가 영역
    getPipeline(type: any, setSrc?: string, setTarget?: string, setKind?: string, setSort?: any, min?: any, max?: any) {
        let newOrderList = [
            {
                $match: {
                    kind: setKind, // sell buy 구분
                    src: setSrc, // 상위컴포넌트에서 파라미터값으로 받아와야함
                    target: setTarget, // 상위컴포넌트에서 파라미터값으로 받아와야함                
                    status: 0,
                    price: { $gte: min, $lte: max }
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
                    _id: setSort, // sell: 1, buy: -1
                }
            }
        ]
    
        let orderpipe = [
            {
                $addFields: {
                    price: { $toDecimal: "$price" },
                    amount: { $toDecimal: "$amount" },
                    status: { $toInt: "$status" }
                },
            },
            {
                $match: {
                    kind: setKind, // sell buy 구분
                    src: setSrc, // 상위컴포넌트에서 파라미터값으로 받아와야함
                    target: setTarget, // 상위컴포넌트에서 파라미터값으로 받아와야함                
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
                $project: {
                   _id : {$toDouble : '$_id'},
                   totalAmount : {$toDouble : '$totalAmount'}
                },
            },
            {
                $sort: {
                    _id: setSort, // sell: 1, buy: -1
                }
            },
            {
                $limit: 12,
            }
        ];
    
        let allAmount = [
            {
                $project: {
                    amount: "$amount",
                    kind: "$kind",
                    src: setSrc,
                    target: setTarget,
                    status: { $toInt: "$status" }
                }
            },
            {
                $match: {
                    status: 0
                },
            },
            {
                $group: {
                    _id: "$kind",
                    totalAmount: { $sum: "$amount" }
                }
            }
        ];
    
        let orderTypeMax = [
            {
                $match: {
                    kind: setKind, // sell buy 구분
                    src: setSrc, // 상위컴포넌트에서 파라미터값으로 받아와야함
                    target: setTarget, // 상위컴포넌트에서 파라미터값으로 받아와야함                
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
                    totalAmount: setSort, // sell: 1, buy: -1
                }
            },
            {
                $limit: 1,
            }
    
    
        ];
    
        switch (type) {
            case 1: return orderpipe;
            case 2: return allAmount;
            case 3: return orderTypeMax;
            case 4: return newOrderList;
            default: return false;
        }
    }

    public async getSellOrderList(setKind: string, setSrc: string, setTarget: string, limit: number){
        
        if(!setKind || !setSrc || !setTarget){
            LogUtil.error({ e: 'getSellOrderList(): param is undefined.' });
            return [];
        }        
        
        let sellOrderList = [];
        try{
            let setSort = 1,
                type = 1;
    
            let sell = this.getPipeline(type, setSrc, setTarget, setKind, setSort);        
            sellOrderList = await OrderCollection.rawCollection().aggregate(sell, { readPreference: 'secondaryPreferred' }).toArray();
        }catch(err){
            LogUtil.error({ e: 'getSellOrderList(): ' + err.message});
            return [];
        }
        return sellOrderList;
    }

    public async getBuyOrderList(setKind: string, setSrc: string, setTarget: string, limit: number){
        if(!setKind || !setSrc || !setTarget){
            LogUtil.error({ e: 'getBuyOrderList(): param is undefined.' });
            return [];
        }        
        let buyOrderList = [];
        try{
            
            let setSort = -1,
                type = 1;
    
            let buy = this.getPipeline(type, setSrc, setTarget, setKind, setSort);            
            buyOrderList = await OrderCollection.rawCollection().aggregate(buy, { readPreference: 'secondaryPreferred' }).toArray();            
        }catch(err){
            LogUtil.error({ e: 'getBuyOrderList(): ' + err.message});
            return [];
        }
        return buyOrderList;
    }

    public async getOrderMaxAmount(setKind: string, setSrc: string, setTarget: string){
        if(!setKind || !setSrc || !setTarget){
            LogUtil.error({ e: 'getOrderMaxAmount(): param is undefined.' });
            return [];
        }     

        let orderMaxAmount = [];
        try{
            let setSort = -1, type = 3;
            let orderTypeMax = this.getPipeline(type, setSrc, setTarget, setKind, setSort);
            
            orderMaxAmount = await OrderCollection.rawCollection().aggregate(orderTypeMax, { readPreference: 'secondaryPreferred' }).toArray();
        }catch(err){
            LogUtil.error({ e: 'getOrderMaxAmount(): ' + err.message});
            return [];
        }
        return orderMaxAmount;
    }

    // 외부거래소 시세, 환율
    public async getForeignTicker(){
        let result;

        try {
            result = await foreignApiCollection.find({}, { readPreference: ReadPref.SECONDARY });
        } catch (err) {
            LogUtil.error({ e: 'getForeignTicker() exception : ' + err.message });
            return undefined;
        }
        
        return result;
    }
}
export const HomeService = new _HomeService();