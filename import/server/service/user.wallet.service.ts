import { LogUtil, ServerUtil, DecimalUtil } from "../lib";
import { UserWalletCollection, Users, CompanyAssetCollection } from "../collections";
import { ResultCode, Trade, UserWalletHistoryType, WalletLedger, LockType, UserWallet, ReadPref } from "../models";
import { UserWalletHistoryService } from "./user.wallet.history.service";
import { CompanyAssetService } from "./companyasset.service";
import { FiatrateService } from "./fiatrate.service";
import { DailyFiatService } from "./daily.fiat.service";
import { CoinService } from "./coin.service";





export class _UserWalletService {

    public isEnoughAvailable(userId: string, assetCode: string, available: number) {
        if (!userId || !assetCode || !Number(available)) {
            LogUtil.error({ e: 'isEnoughAvailable(): param is undefined. ', userId, assetCode, available });
            return false;
        }

        try {
            let userWallet = UserWalletCollection.findOne({ assetCode: assetCode, owner: userId });

            if (!userWallet) {
                LogUtil.error({ e: 'isEnoughAvailable(): userWallet is undefined.', userId, assetCode })
                return false;
            }

            if (DecimalUtil.sub(userWallet.available, available) < 0) {
                return false;
            }

        } catch (err) {
            LogUtil.error({ e: 'isEnoughAvailable(): ' + err.message })
            return false;
        }

        return true;
    }

    public async tradeCoin(trade: Trade) {
        if (!trade) {
            LogUtil.error({ e: 'tradeCoin(): param is undefined. ' });
            return { code: ResultCode.ERROR };
        }

        let companyAssetLock;

        let srcFromUser;
        let srcFromBalance;
        let srcFromAvailable;
        let srcToBalance;
        let srcTradeCost;
        let srcTakerFee;
        let srcMakerFee;

        let targetFromUser;
        let targetFromBalance;
        let targetFromAvailable;
        let targetToBalance;

        srcTradeCost = DecimalUtil.mul(trade.amount, trade.price, true);
        srcTakerFee = DecimalUtil.mul(srcTradeCost, trade.ownerFee, true);
        srcMakerFee = DecimalUtil.mul(srcTradeCost, trade.orderOwnerFee, true);

        if (trade.kind == 'buy') {
            // 매수 체결 일 때

            // src를 지불하는 건 taker 
            srcFromUser = trade.owner;
            // src 지불 금액은 takerFee로 계산
            srcFromBalance = - DecimalUtil.add(srcTradeCost, srcTakerFee, true);
            srcFromAvailable = - DecimalUtil.add(srcTradeCost, srcTakerFee, true);
            // src 정산 금액은 makerFee로 계산
            srcToBalance = DecimalUtil.sub(srcTradeCost, srcMakerFee, true);

            // target을 지불하는 건 maker
            targetFromUser = trade.orderOwner;
            // target 지불 금액은 수량 그대로
            targetFromBalance = -trade.amount;
            // 매수체결 일 때, target을 지불하는 건 maker이기 때문에 available을 계산하지 않는다. (이미 주문 등록 시, available을 차감하였기 때문)
            targetFromAvailable = 0;
            // target 정산 금액도 수량 그대로
            targetToBalance = trade.amount;
        } else {
            // 매도 체결은 매수 체결과 반대로 계산이 된다.

            srcFromUser = trade.orderOwner;
            srcFromBalance = - DecimalUtil.add(srcTradeCost, srcMakerFee);
            srcFromAvailable = 0;
            srcToBalance = DecimalUtil.sub(srcTradeCost, srcTakerFee);

            targetFromUser = trade.owner;
            targetFromBalance = -trade.amount;
            targetFromAvailable = -trade.amount;
            targetToBalance = trade.amount;
        }

        let result;

        let walletLedger = this.initWalletLedger({
            owner: srcFromUser,
            assetCode: trade.src,
            balance: srcFromBalance,
            available: srcFromAvailable
        });        
        result = await this.updateBalance(walletLedger, UserWalletHistoryType.trade , trade.src);
        if (!result || result.code != 200) {
            LogUtil.error({ e: 'tradeCoin(): update srcFrom is failed. ', walletLedger });
            return { code: ResultCode.ERROR };
        }        

        walletLedger = this.initWalletLedger({
            owner: targetFromUser,
            assetCode: trade.target,
            balance: targetFromBalance,
            available: targetFromAvailable
        });        
        result = await this.updateBalance(walletLedger, UserWalletHistoryType.trade, trade.src);
        if (!result || result.code != 200) {
            LogUtil.error({ e: 'tradeCoin(): update targetFrom is failed. ', walletLedger });
            return { code: ResultCode.ERROR };
        }
        
        try{
            companyAssetLock = await ServerUtil.getLock(LockType.companyAsset, trade.src + trade.target, 1000);
            let companyAsset = await CompanyAssetService.getCompanyAsset(trade.src, trade.target);
            companyAsset = CompanyAssetService.initCompanyAsset(trade, companyAsset);
            CompanyAssetService.setCompanyAsset(companyAsset);
            companyAssetLock.unlock();
            
            let fiatRate = FiatrateService.initValue(companyAsset, trade.amount, trade.kind == 'sell' ? 'buy' : 'sell');
            FiatrateService.createFiat(fiatRate);

            let dailyFiatRate = DailyFiatService.initValue(fiatRate);
            DailyFiatService.updateDailyFiat(dailyFiatRate);
        }catch(err){
            LogUtil.error({ e: 'tradeCoin(): update companyAsset is failed'});
        }finally{
            if(companyAssetLock){ companyAssetLock.unlock(); }
        }        

        walletLedger = this.initWalletLedger({
            owner: targetFromUser,
            assetCode: trade.src,
            balance: srcToBalance,
            available: srcToBalance
        });        
        result = await this.updateBalance(walletLedger, UserWalletHistoryType.trade , trade.src);
        if (!result || result.code != 200) {
            LogUtil.error({ e: 'tradeCoin(): update srcTo is failed. ', walletLedger });
            return { code: ResultCode.ERROR };
        }

        walletLedger = this.initWalletLedger({
            owner: srcFromUser,
            assetCode: trade.target,
            balance: targetToBalance,
            available: targetToBalance
        });        
        result = await this.updateBalance(walletLedger, UserWalletHistoryType.trade , trade.src);
        if (!result || result.code != 200) {
            LogUtil.error({ e: 'tradeCoin(): update targetTo is failed. ', walletLedger });
            return { code: ResultCode.ERROR };
        }

        return result;
    }

    /*
    *   owner: string
    *   assetCode: string
    *   balance: number ( 0 is valid. )
    *   available: number ( 0 is valid. )    
    */
    public initWalletLedger(ledgerInfo: any) {
        if (!ledgerInfo || !ledgerInfo.owner || !ledgerInfo.assetCode
            || (!Number(ledgerInfo.balance) && ledgerInfo.balance != 0)
            || (!Number(ledgerInfo.available) && ledgerInfo.available != 0)) {

            LogUtil.error({ e: 'initWalletLedger(): Invalid Param.' });
            return undefined;
        }

        let walletLedger: WalletLedger = {
            owner: ledgerInfo.owner,
            assetCode: ledgerInfo.assetCode,
            balance: ledgerInfo.balance,
            available: ledgerInfo.available
        }

        return walletLedger;
    }

    public async updateBalance(walletLedger: WalletLedger, balanceType: UserWalletHistoryType ,  market : string) {
        if (!walletLedger
            || !walletLedger.owner || !walletLedger.assetCode
            || (!Number(walletLedger.balance) && walletLedger.balance != 0)
            || (!Number(walletLedger.available) && walletLedger.available != 0)) {
            LogUtil.error({ e: 'updateBalance(): Invalid Param.', walletLedger })
            return { code: ResultCode.ERROR }
        }        

        let result;
        let walletLock;

        try {
            // 0. 데이터 동시성 제어를 위해 지갑 잠금.
            walletLock = await ServerUtil.getLock(LockType.wallet, walletLedger.owner + walletLedger.assetCode, 1000);

            // 1. 사용자의 지갑을 꺼내서 객체를 복사 후 지갑 유무 확인. 
            let prevUserWallet = this.getUserWallet(walletLedger.owner, walletLedger.assetCode);
            let userWallet = this.copyWallet(prevUserWallet);

            if (!userWallet) {
                LogUtil.error({ e: 'updateBalance(): userWallet is undefined.' });
                return { code: ResultCode.ERROR }
            }

            // 2. 복사한 객체로 연산 수행.        
            let coinEval = await this.getCoinEval(userWallet, walletLedger.balance , market);            
            userWallet.strBalance = DecimalUtil.add(userWallet.strBalance, walletLedger.balance, true);            
            userWallet.strAvailable = DecimalUtil.add(userWallet.strAvailable, walletLedger.available, true);            
            userWallet.eval = DecimalUtil.add(userWallet.eval, coinEval);
            if(userWallet.eval < 0){
                userWallet.eval = 0;
            }
            
            // let USDTcoinEval = await this.getUSDTCoinEval(userWallet, walletLedger.balance , market);     
            // if(!userWallet.USDTeval){
            //     userWallet.USDTeval = 0
            // }else{
            //     userWallet.USDTeval = DecimalUtil.add(userWallet.USDTeval, USDTcoinEval);
            // }
            
            // if(userWallet.USDTcoinEval < 0){
            //     userWallet.USDTeval = 0;
            // }

            // 3. 사용자의 자산이 충분한지 확인.
            if (Number(userWallet.strBalance) < 0 || Number(userWallet.strAvailable) < 0) {
                LogUtil.error({ e: 'updateBalance(): balance is lack.', userWallet });
                return { code: ResultCode.ERROR }
            }            

            // 4. 자산이 충분하다면 업데이트 수행.                        
            /* USDT eval 계산 보류 */
            // result = await UserWalletCollection.update({ _id: userWallet._id }, { $set: { available: DecimalUtil.floorHighNumDecimalPoint(userWallet.strAvailable), balance: DecimalUtil.floorHighNumDecimalPoint(userWallet.strBalance), eval: Number(userWallet.eval),USDTeval: Number(userWallet.USDTeval), strBalance: userWallet.strBalance, strAvailable: userWallet.strAvailable } }, {upsert: true}).first().toPromise();
            result = await UserWalletCollection.update({ _id: userWallet._id }, { $set: { available: DecimalUtil.floorHighNumDecimalPoint(userWallet.strAvailable), balance: DecimalUtil.floorHighNumDecimalPoint(userWallet.strBalance), eval: Number(userWallet.eval), strBalance: userWallet.strBalance, strAvailable: userWallet.strAvailable } }, { upsert: true }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'updateBalance(): To update wallet is failed.' });
                return { code: ResultCode.ERROR }
            }            

            // 5. 자산 변경 이력 추가.        
            UserWalletHistoryService.createWalletHistory(prevUserWallet, userWallet, balanceType);

        } catch (err) {
            LogUtil.error({ e: 'updateBalance(): ' + err.message });
            return { code: ResultCode.ERROR }
        } finally {
            if (walletLock) {
                walletLock.unlock();
            }
        }

        return { code: ResultCode.SUC }
    }


    public getUserWallet(owner: string, assetCode: string) {
        if (!owner || !assetCode) {
            LogUtil.error({ e: 'getUserWallet(): param is undefined. ', owner, assetCode });
            return undefined;
        }

        let userWallet;
        try {
            userWallet = UserWalletCollection.findOne({ 'assetCode': assetCode, 'owner': owner, 'useYn': true });
        } catch (err) {
            LogUtil.error({ e: 'getUserWallet(): ' + err.message });
            return undefined;
        }

        return userWallet;
    }

    private copyWallet(userWallet: UserWallet) {
        if (!userWallet) {
            return undefined;
        }

        let copyWallet = userWallet.constructor();

        for (let attr in userWallet) {
            if (userWallet.hasOwnProperty(attr)) {
                copyWallet[attr] = userWallet[attr];
            }
            
            if (!userWallet.strAvailable){
                userWallet['strAvailable'] = String(userWallet['available']);
                copyWallet['strAvailable'] = String(userWallet['available']);
            }
            
            if (!userWallet.strBalance){
                userWallet['strBalance'] = String(userWallet['balance']);
                copyWallet['strBalance'] = String(userWallet['balance']);
            }    
        }

        return copyWallet;
    }

    private getCoinEval(userWallet: UserWallet, balance: number, market : string) {
        if (!userWallet || !Number(balance) || userWallet.assetCode == 'KRW') {
            return 0;
        }

        let coinPresentPrice =0;
        let companyAsset = CompanyAssetService.getCompanyAsset('KRW', userWallet.assetCode);
        if (!companyAsset || !Number(companyAsset.presentPrice)) {
            companyAsset = CompanyAssetService.getCompanyAssetCode(userWallet.assetCode);
            coinPresentPrice = (companyAsset.presentPrice * companyAsset.KRWclosingPrice);
            if (!companyAsset || !Number(companyAsset.presentPrice) || !Number(coinPresentPrice)) {
                LogUtil.error({ e: 'getCoinEval(): companyAsset is undefeined.', companyAsset });
                return 0;
            }
        }else{
            coinPresentPrice = companyAsset.presentPrice;
        }

        // 코인의 현재가를 세팅
        let presentPrice = 0;
        presentPrice = coinPresentPrice;
        
        if (balance > 0) {
            return Math.floor(presentPrice * balance);
        } else {
            if (!Number(userWallet.eval)) {
                return 0;
            }
            if (userWallet.balance == Math.abs(balance)) {
                return -userWallet.eval;
            }
            return Math.floor(userWallet.eval / userWallet.balance * balance);
        }
    }

    private async getUSDTCoinEval(userWallet: UserWallet, balance: number , market : string) {
        if (!userWallet || !Number(balance) || market =='KRW' || market ==  userWallet.assetCode) {
            return 0;
        }
        let src = 'USDT';
        if(market == 'transfer' || userWallet.assetCode == market){
            src = 'USDT'
        }else{
            src = market
        }

        let companyAsset = await CompanyAssetService.getCompanyAsset(src, userWallet.assetCode);
        
        if (!companyAsset || !Number(companyAsset.presentPrice)) {
            LogUtil.error({ e: 'getUSDTCoinEval(): companyAsset is undefeined.', companyAsset });
            return 0;
        }
        let presentPrice = 0 ;
        if(src == 'USDT'){
            presentPrice = companyAsset.presentPrice;
        }else{
            presentPrice = (companyAsset.presentPrice * companyAsset.USDTclosingPrice);
        }

        if (balance > 0) {
            return DecimalUtil.mul(presentPrice , balance);
        } else {
            if (!Number(userWallet.USDTeval)) {
                return 0;
            }
            if (userWallet.balance == Math.abs(balance)) {
                return -userWallet.USDTeval;
            }
            return Math.floor(userWallet.USDTeval / userWallet.balance * balance);
        }
    }

    public async getAllUserWallet(userId: string){
        if(!userId){
            LogUtil.error({ message : 'getAllUserWallet(): not found User.'});
            return [];
        }        

        let result;

        try {
            result = await UserWalletCollection.find({ owner: userId }, { readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ message : 'getAllUserWallet(): exception. ' + err.message });
            return [];
        }

        return result;
    }
    
    public isInternalAddress(address: string, assetCode: string) {
        if (!address || !assetCode) {
            LogUtil.error({ e: "isInternalAddress(): Invalid param.", address, assetCode });
            return false;
        }

        try{
            let wallet = UserWalletCollection.findOne({ assetCode: assetCode, address: {$regex: address, $options: 'i'}, useYn: true });
            if (!wallet) {
                return false;
            }
        }catch(err){
            LogUtil.error({ e: "isInternalAddress(): " + err.message, address, assetCode });
            return false
        }

        return true;
    }

    public getEmailByWalletAddress(assetCode: string, address: string) {
        if (!address || !assetCode) {
            LogUtil.error({ e: 'getEmailByWalletAddress(): param is undefined. ', assetCode, address})
            return undefined;
        }

        let userWallet;
        let user;
        try {

            userWallet = UserWalletCollection.findOne({ assetCode: assetCode, address: address });
            if (!userWallet) {
                return undefined;
            }

            user = Users.findOne({ _id: userWallet.owner });
            if (!user || !user['emails'] || !user['emails'][0]) {
                return undefined;
            }
        } catch (err) {
            LogUtil.error({ e: 'getUserWalletByAddress' + err.message })
            return undefined;
        }

        return user['emails'][0]['address'];
    }

    public async getNewCoinAddress(assetCode: string, userId: string) {
        if (!assetCode || !userId) {
            LogUtil.error({ e: 'makeCoinAddress(): invalid param.', assetCode, userId })
            return { code: ResultCode.ERROR }
        }

        try {
            let userWallet = UserWalletCollection.findOne({ owner: userId, assetCode: assetCode });

            if (!userWallet || userWallet.address) {
                LogUtil.error({ e: 'makeCoinAddress(): invalid userWallet.', userWallet })
                return { code: ResultCode.ERROR }
            }

            let newCoinAddress = await CoinService.getNewAddress(assetCode, userId);

            if (!newCoinAddress) {
                LogUtil.error({ e: 'makeCoinAddress(): invalid coinAddress.' })
                return { code: ResultCode.ERROR }
            }

            let storedUserWallet = UserWalletCollection.findOne({ assetCode: assetCode, address: newCoinAddress });
            if (storedUserWallet) {
                LogUtil.error({ e: 'makeCoinAddress(): the address is invalid.' })
                return { code: ResultCode.ERROR }
            }

            let result = await UserWalletCollection.update({ _id: userWallet._id }, { $set: { address: newCoinAddress } }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'makeCoinAddress(): updating address is failed.', userWallet })
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'makeCoinAddress(): ' + err.message })
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }
    initValues(companyAsset : any, owner: string, countryCode? : string): UserWallet {
        if (!companyAsset || !companyAsset.code || !owner) {
            LogUtil.error({ e: 'wallet.initValues(): Invalid param.' });
            return undefined;
        }

        var userWallet = {
            'address': '',
            'assetCode': companyAsset.code,
            'assetName': companyAsset.name,
            'available': 0.0,
            'balance': 0.0,
            'eval': 0.0,
            'USDTeval':0.0,
            'kind': 'coin',
            'owner': owner,
            'useYn': true,
            'status': 0,
            'uWId': '0'
        };

        switch (countryCode) {
            case 'cn':
                userWallet['assetNameCN'] = companyAsset.coinCnName;
                break;
            case undefined || 'kr' :
                break;
            default:
                break;
        }

        if (userWallet.assetCode == 'KRW') {
            userWallet.kind = 'cash';
        }

        return userWallet;
    }
    async createAllWallets(userId: string, countryCode : string) {
        if (!userId) {
            LogUtil.error({ e: 'createAllWallets(): invalidParam.' })
            return { code: ResultCode.ERROR_INVALID_PARAM }
        }
        //let companyAssetCodes = await CompanyAssetCollection.rawCollection().distinct('code',{}, { readPreference: ReadPref.SECONDARY_PREFERRED });
        // let companyAssetCodes = ['BTC','BCH','ETH','LTC','XMR','ADA','XRP','QTUM','USDT']//
        let companyAsset;
        let uniqueCompanyAsset; // 중복이 제거된 배열

        try {
            if(!countryCode || countryCode == 'kr'){
                companyAsset = await CompanyAssetCollection.find({ disPlayKR : true }, {readPreference : ReadPref.SECONDARY_PREFERRED});
                companyAsset.unshift({code : 'KRW', name : '원화'});
            } else if(countryCode == 'cn'){
                companyAsset = await CompanyAssetCollection.find({disPlayCN : true, useYn : true}, {readPreference : ReadPref.SECONDARY_PREFERRED});
            }
            
            // 중복이 제거된 object 배열로 만듬.
            uniqueCompanyAsset = companyAsset.reduce((acc, current)=>{
                let x = acc.find(arr => arr.code === current.code);
                if(!x){
                    return acc.concat([current]);
                } else {
                    return acc;
                }
            }, []);

        } catch (err) {
            LogUtil.error({ e : 'createAllWallets(): ' + err.message});
            return {code : ResultCode.ERROR};
        }

        let userWallet: UserWallet;
        let userWalletList = [];

        for (let i = 0; i < uniqueCompanyAsset.length; i++) {
            userWallet = this.initValues(uniqueCompanyAsset[i], userId, countryCode);
            userWalletList.push(userWallet);
        }

        try {
            await UserWalletCollection.rawCollection().insertMany(userWalletList);
            let krwWallet = UserWalletCollection.findOne({ assetCode: 'KRW', owner: userId });
            if (krwWallet) {
                UserWalletCollection.update({ _id: krwWallet._id }, { $set: { address: krwWallet._id } });
            }
        } catch (err) {
            LogUtil.error({ e: 'createAllWallets(): ' + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }
}
export const UserWalletService = new _UserWalletService();