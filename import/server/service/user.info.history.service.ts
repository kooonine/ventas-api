import { Order, ResultCode, Status, Trade } from "../models";

import { LogUtil, ServerUtil } from "../lib";
import { UserInfoHistoryCollection, TradeCollection, TransferCollection, HistoryCollection } from "../collections";


export class _UserInfoHistoryService {

    public async setUserTrade(tradeId: string) {
        if (!tradeId) {
            LogUtil.error({ e: 'setUserTrade(): invalid param.', tradeId });
            return { code: ResultCode.ERROR, msg: 'userinfoTrade filled' }
        }

        try {
            let result = await TradeCollection.findOne({"_id" : tradeId});
            if(!result){
                LogUtil.error({ e: 'setUserTrade(): not find trade.', tradeId });
                return { code: ResultCode.ERROR, msg: 'userinfoTrade filled' }
            }
            let ownerUserInfo = await UserInfoHistoryCollection.findOne({ "_id" : result.owner },{fields : {_id : 0, 'history.trade' : 1}});
            let orderUserInfo = await UserInfoHistoryCollection.findOne({ "_id" : result.orderOwner },{fields : {_id : 0, 'history.trade' : 1}});

            let ownerTrade;
            let orderOwnerTrade;
            ownerTrade = ownerUserInfo.history.trade;
            orderOwnerTrade = orderUserInfo.history.trade;
            
            if(!ownerUserInfo){
                await UserInfoHistoryCollection.insert({_id : result.owner, history : { notice : [], trade : [] , login : [], transfer : []}})
            }
            if(!orderUserInfo){
                await UserInfoHistoryCollection.insert({_id : result.orderOwner, history : { notice : [], trade : [] , login : [], transfer : []}})
            }
            if(result.owner == result.orderOwner){
                
                if(ownerTrade.length < 500){
                    await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.trade' : result}});
                }else{
                    await UserInfoHistoryCollection.update({_id :result.owner}, {$pop : {"history.trade" : -1}});
                    await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.trade' : result}});
                }
            }else{
                if(ownerTrade.length < 500){
                    await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.trade' : result}});
                }else{
                    await UserInfoHistoryCollection.update({_id :result.owner}, {$pop : {"history.trade" : -1}});
                    await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.trade' : result}});
                }

                if(orderOwnerTrade.length < 500){
                    await UserInfoHistoryCollection.update({_id : result.orderOwner },{$push :{ 'history.trade' : result}});
                }else{
                    await UserInfoHistoryCollection.update({_id :result.orderOwner}, {$pop : {"history.trade" : -1}});
                    await UserInfoHistoryCollection.update({_id : result.orderOwner },{$push :{ 'history.trade' : result}});
                }
                
            }

        } catch (error) {
            LogUtil.error({ e: 'setUserTrade(): ' + error.message });
            return { code: ResultCode.ERROR, msg: 'userinfoTrade filled!!' };
        }
    }

    public async pushUserTransfer(transferId : string){
        if (!transferId) {
            LogUtil.error({ e: 'pushUserTransfer(): invalid param.', transferId });
            return { code: ResultCode.ERROR, msg: 'userinfoTransfer filled' }
        }

        try {
            let result = await TransferCollection.findOne({"_id" : transferId});
            if(!result){
                LogUtil.error({ e: 'pushUserTransfer(): not find Transfer.', transferId });
                return { code: ResultCode.ERROR, msg: 'userinfoTransfer filled' }
            }

            let userInfoHistory = await UserInfoHistoryCollection.findOneSecondary({_id :result.owner});
            if(!userInfoHistory){
                await UserInfoHistoryCollection.insert({_id : result.owner, history : { notice : [], trade : [] , login : [], transfer : []}});
            }

            await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.transfer' : result}});

        } catch (error) {
            LogUtil.error({ e: 'pushUserTransfer(): ' + error.message });
            return { code: ResultCode.ERROR, msg: 'userinfoTransfer filled!!' };
        }
    }
    public async setUserTransfer(transferId: string) {
        if (!transferId) {
            LogUtil.error({ e: 'setUserTransfer(): invalid param.', transferId });
            return { code: ResultCode.ERROR, msg: 'userinfotransfer filled' }
        }

        try {
            let result = await TransferCollection.findOne({"_id" : transferId});
            if(!result){
                LogUtil.error({ e: 'setUserTransfer(): not find transfer.', transferId });
                return { code: ResultCode.ERROR, msg: 'userinfoTransfer filled' }
            }
            //101transfer 지우고
            await UserInfoHistoryCollection.update({_id :result.owner}, {$pull : {"history.transfer" : {_id : transferId}}},{multi:true});
            //상태 변경 transfer 삽입
            await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.transfer' : result}});

        } catch (error) {
            LogUtil.error({ e: 'setUserTransfer(): ' + error.message });
            return { code: ResultCode.ERROR, msg: 'userinfoTransfer filled!!' };
        }
    }
    // user-history collection 로그인 이력
    public async setUserLoginHistory(historyId : string){
        let result;
        if(!historyId){
            LogUtil.error({ e : 'setUserLoginHistory(): invalid param.' , historyId});
            return {code : ResultCode.ERROR, msg : 'setUserLoginHistory failed'};
        }

        try {
            result = await HistoryCollection.findOneSecondary({ "_id" : historyId });
            
            if(!result){
                LogUtil.error({ e : 'setUserLoginHistory(): not found loginHistory.' , result });    
                return {code : ResultCode.ERROR, msg : 'setUserLoginHistory failed'};
            }
            let userInfo = await UserInfoHistoryCollection.findOne({ "_id" : result.owner });
            
            if(!userInfo){
                await UserInfoHistoryCollection.insert({_id : result.owner, history : { notice : [], trade : [] , login : [], transfer : []}})
                await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.login' : result}});
            }else {
                await UserInfoHistoryCollection.update({_id : result.owner },{$push :{ 'history.login' : result}});
            }
        } catch (err) {
            LogUtil.error({ e : 'setUserLoginHistory(): exception.' + err.message });
            return { code : ResultCode.ERROR, msg : 'setUserLoginHistory failed' };
        }
    }

    //user info history 알림
    public async AlluserInfoHistory(userId : string){
        let result
        if(!userId){
            LogUtil.error({ e : 'AlluserInfoHistory(): invalid user.' , userId});
            return {code : ResultCode.ERROR, msg : 'AlluserInfoHistory failed'};
        }
        try {
            result = await UserInfoHistoryCollection.findOne({ "_id" : userId });
            if(!result){
                LogUtil.error({ e : 'AlluserInfoHistory(): not found UserInfoHistoryCollection.' , userId });    
                return {code : ResultCode.ERROR, msg : 'UserInfoHistoryCollection failed'};
            }

        } catch (err) {
            LogUtil.error({ e : 'AlluserInfoHistory(): exception.' + err.message });
            return { code : ResultCode.ERROR, msg : 'AlluserInfoHistory failed' };
        }
        return result;
    }
    // user-history collection 로그인 이력
    public async setUserInfoHistory(){
        let user = Meteor.user();
        if (!user) {
            LogUtil.error({ e: 'setUserInfoHistory(): user is undefined.' });
            return { code: ResultCode.NOTFOUND };
        }

        try {
            let result = await UserInfoHistoryCollection.findOne({ "_id" : user._id });
            
            if(result){
                LogUtil.error({ e : 'setUserInfoHistory(): already exists'});    
                return {code : ResultCode.ERROR, msg : 'setUserInfoHistory failed'};
            }

            await UserInfoHistoryCollection.insert({_id : user._id, history : { notice : [], trade : [] , login : [], transfer : []}})

        } catch (err) {
            LogUtil.error({ e : 'setUserInfoHistory(): exception.' + err.message });
            return { code : ResultCode.ERROR, msg : 'setUserInfoHistory failed' };
        }
    }
}
export const UserInfoHistoryService = new _UserInfoHistoryService();