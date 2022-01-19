import { LogUtil, ServerUtil } from "../lib";
import { Users, UserWalletCollection } from "../collections";
import { Trade, ResultCode, WalletLedger, UserWalletHistoryType, LockType } from "../models";
import { UserWalletHistoryService } from "./user.wallet.history.service";
import { HomeService } from "./home.service";
import { UserWalletService } from "./user.wallet.service";
import { OrderService } from "./order.service";
import { TransferService } from "./transfer.service";


export class _UserService {

    public getUserById(_id: string) {
        if (!_id) {
            LogUtil.error({ e: "getUserById(): param is undefined." });
            return undefined;
        }

        let user;
        try {
            user = Users.findOne({ _id: _id });
        } catch (err) {
            LogUtil.error({ e: "getUserById(): " + err.message });
            return undefined;
        }

        return user;
    }

    public getUserByEmail(email: string) {
        if (!email) {
            return undefined;
        }

        let user;
        try {
            user = Users.findOne({ 'emails.address': email });
        } catch (err) {
            LogUtil.error({ e: 'getUserByEmail(): ' + err.message });
            return;
        }

        return user;
    }

    async updateUserAgree(agreeType: string, value: boolean) {
        LogUtil.info({ console: 'updateUserAgree' }, true);
        
        if (!agreeType) {
            LogUtil.error({ e: 'updateUserAgree(): agreeType is undefined.' });
            return { code: ResultCode.ERROR_INVALID_PARAM }
        }

        let result;
        let user = Meteor.user();

        if (!user) {
            LogUtil.error({ e: 'updateUserAgree(): user is undefined.' });
            return { code: ResultCode.NOTFOUND };
        }

        // push 항목이 없다면 초기화 해준다.
        if (!user.profile.agree.push) {
            user.profile.agree['push'] = {};

            user.profile.agree.push['email'] = false;
            user.profile.agree.push['sms'] = false;
            // user.profile.agree.push['loginAlarm'] = false;
            // user.profile.agree.push['tradeAlarm'] = false;
            // user.profile.agree.push['transferAlarm'] = false;
            // user.profile.agree.push['noticeAlarm'] = false;
        }

        user.profile.agree.push[agreeType] = value;

        try {
            result = await Users.update({ _id: user._id }, { $set: { profile: user.profile } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'updateUserAgree(): update failed.', result });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'updateUserAgree(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC, result }
    }

    async checkUserSecessionAvailability(){        
        let userId = Meteor.userId();
        if(!userId){
            LogUtil.error({ e: "checkUserSecessionAvailability(): userId is undefined." });
            return undefined;
        }
        
        let result = {
            availability : false,
            reason : {
                balance : false,                         // 잔액조건이 만족됐는지
                zeroStatusOrder : false,                 // 미체결 조건이 만족됐는지
                notApprovalTransfer : false              // 이체내역 조건이 만족됐는지
            }
        };

        // 1. 잔액이 출금수수료보다 높을경우 탈퇴 불가
        let companyAssetList = await HomeService.CompanyAssetListALL('USDT');
        let userWalletList = await UserWalletService.getAllUserWallet(userId);
        let withdrawFeeList = {};

        for(let i = 0; i < companyAssetList.length; i++){            
            withdrawFeeList[companyAssetList[i].code] = companyAssetList[i].withdrawFee;
        }
        
        for(let i = 0; i < userWalletList.length; i++){
            let assetCode = userWalletList[i].assetCode;
            if(userWalletList[i].balance < withdrawFeeList[assetCode] || userWalletList[i].balance==0){
                continue;
            } else {

                return { msg : '(1st term) balance term is false. ', reasonWallet : userWalletList[i], withdrawFee : withdrawFeeList[assetCode] , result };
            }
        }
        
        result.reason.balance = true;

        // 2. 미체결 내역 유무 검사
        let notConcludedOrder = await OrderService.checkZeroStatusOrder(userId);
        if(!notConcludedOrder){
            return { msg : '(2nd term) user have notConculdedOrder' , result }
        }

        result.reason.zeroStatusOrder = true;

        // 3. 진행중인 이체내역 유무 검사
        await TransferService.checkProceedingTransfer(userId).then((res)=>{
            if(!res){
                return { msg : '(3rd term) user have proceedingTransfer' , result }
            }
        })

        result.reason.notApprovalTransfer = true;

        if(result.reason.balance && result.reason.zeroStatusOrder && result.reason.notApprovalTransfer){
            result.availability = true;
        }

        return { msg : 'can Secession', result};
    }

    async userSecession(){
        let userId = Meteor.userId();
        
        // 회원탈퇴 메일보낼 때 사용할 변수들
        let email;
        let countryCode;

        if(!userId){
            LogUtil.error({ e: "userSecession(): userId is undefined." });
            return { code: ResultCode.ERROR };
        }

        try {
            let user = await Users.findOneSecondary({ _id: userId });
    
            if (!user) {
                LogUtil.error({ e: "userSecession(): user is undefined." });
                return { code: ResultCode.ERROR };
            }
    
            // 프로필 변경 
            let profile = user['profile'];
            
            email = user['emails'][0]['address'];
            countryCode = profile.country;

            // 계좌정보 삭제
            profile.bankYn = 'N';
            profile.bankInfo = {
                no : '',
                name : '',
                code : '',
                ownerName : ''
            }

            // 휴대폰번호
            if(!profile.phoneNo){

            } else {
                profile.phoneNo = 'X'+profile.phoneNo;
            }

            // 탈퇴자 구분 컬럼 추가
            profile.secessionYN = true; // 탈퇴여부
            profile.outDt = new Date(); // 탈퇴일
            
            let result = await Users.update({ _id: user._id }, { $set: { profile: profile } });
        } catch (err) {
            LogUtil.error({ e: "userSecession(): db exception.. " + err.message });
            return { code : ResultCode.ERROR };
        }
        
        Meteor.call('emailForUserSecession', email, countryCode); // 탈퇴알림메일 발송
        LogUtil.info({ i: ' userSecession ', userId : Meteor.userId() });
        return { code: ResultCode.SUC };
    }
    async updateUserCountry(value: string) {
        LogUtil.info({ console: 'updateUserCountry' }, true);
        

        let result;
        let user = Meteor.user();

        if (!user) {
            LogUtil.error({ e: 'updateUserCountry(): user is undefined.' });
            return { code: ResultCode.NOTFOUND };
        }

        // push 항목이 없다면 초기화 해준다.
        if (!user.profile.country) {
            user.profile['country'] = {};
        }

        user.profile['country'] = value;

        try {
            result = await Users.update({ _id: user._id }, { $set: { profile: user.profile } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'updateUserCountry(): update failed.', result });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'updateUserCountry(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC, result }
    }
    async updateUserOtpOut() {
        LogUtil.info({ console: 'updateUserOtpOut' }, true);
        

        let result;
        let user = Meteor.user();

        if (!user) {
            LogUtil.error({ e: 'updateUserOtpOut(): user is undefined.' });
            return { code: ResultCode.NOTFOUND };
        }


        user.profile['otp'] = false;

        try {
            result = await Users.update({ _id: user._id }, { $set: { profile: user.profile } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'updateUserOtpOut(): update failed.', result });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'updateUserOtpOut(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC, result }
    }

    async updateUsercert(type: string, value: string) {
        LogUtil.info({ console: 'updateUsercert' }, true);
        

        let result;
        let user = Meteor.user();

        if (!user) {
            LogUtil.error({ e: 'updateUsercert(): user is undefined.' });
            return { code: ResultCode.NOTFOUND };
        }

        // push 항목이 없다면 초기화 해준다.
        if (!user.profile[type]) {
            user.profile[type] = {};
        }

        user.profile[type] = value;

        try {
            result = await Users.update({ _id: user._id }, { $set: { profile: user.profile } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'updateUsercert(): update failed.', result });
                return { code: ResultCode.ERROR }
            }

        } catch (err) {
            LogUtil.error({ e: 'updateUsercert(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC, result }
    }
}
export const UserService = new _UserService();