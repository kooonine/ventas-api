import { Meteor } from 'meteor/meteor';
import { CertsColls, Users, HistoryCollection } from '../collections';
import * as _ from 'lodash';
import { ServerUtil } from '../lib/server.util';
import { LogUtil } from '../lib';
import { User, Cert, ResultCode, Const } from "../models";
import { SSR } from 'meteor/meteorhacks:ssr';
import { commonSvc, EventService, UserWalletService, UserInfoHistoryService} from '../service';
import { check } from 'meteor/check';
import { Email } from 'meteor/email';
import { FCMService } from '../service/fcm.service';


SSR.compileTemplate('emailcert', Assets.getText('email-cert.html'));
SSR.compileTemplate('emailevent', Assets.getText('email-event.html'));
SSR.compileTemplate('emailcertpw', Assets.getText('email-certpw.html'));
SSR.compileTemplate('login_email', Assets.getText('email-login.html'));
SSR.compileTemplate('cn_userinfo_change', Assets.getText('cn-email-userinfo-change.html'));
SSR.compileTemplate('kr_userinfo_change', Assets.getText('kr-email-userinfo-change.html'));

Meteor.methods({
    /**
     * nice 용 암호화.
     * type=='reg'  이면 콜랙 url을 sucReq 로 받는다. 해당 url 은 사용자를 확인하지 않는다.
     */
    // async createEnc(type: string = 'new', email: string = '', sucUrl, failUrl) {
    //     let cert: any = {};
    //     cert.certType = 'nice';
    //     if (type == 'reg' && email) {
    //         cert.userId = email;
    //     } else {
    //         cert.userId = Meteor.userId();
    //     }
    //     cert.certYn = false;

    //     let id = CertsColls.collection.insert(cert);
    //     const enc = await ServerUtil.getNiceId(id, type, sucUrl, failUrl);

    //     CertsColls.collection.update(id, {
    //         $set: {
    //             cert: enc
    //         }
    //     });
    //     cert.enc = enc;
    //     cert._id = id;
    //     return cert;
    // },
    /**
     * 휴대폰인증,이메일인증 패스워드 변경
     * @param email  이메일 
     * @param certId  인증값
     * @param passwd  신규패스워드
     * @param type  타입(nice, email)
    */
//    getUserByEmail(email: string) {
//         if (!email) {
//             return undefined;
//         }
//         let user;
//         try {
//             user = Users.findOne({ 'emails.address': email });
//             if (!user) {
//                 return undefined;
//             }
//         } catch (err) {
//             LogUtil.error({ message: 'getUserByEmail(): ' + err.message });
//             return;
//         }
//         return user
//     },

    /**
     * 비밀번호찾기 이메일 발송
     * @param to 
     */
    sendVerifyEmail(to, sendYn) {
        check([to], [String]);
        const exist: User = Users.collection.findOne({ 'emails.address': to }) as User;
        if (exist) {
            return { code: ResultCode.EXIST_ERR };
        }

        let certNum = commonSvc.randomNum(6);
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNum;
        cert.target = to;
        cert.certType = Const.CATE_EMAIL_VERI;

        CertsColls.collection.insert(cert);
        this.unblock();

        try {
            if (sendYn) {
                Email.send({
                    to: to,
                    from: Meteor.settings.private.email.senderAlias,
                    subject: "[벤타스비트] 회원가입 인증번호입니다.",
                    html: SSR.render('emailcert', { certKey: certNum })
                });
            }
        } catch (err) {
            LogUtil.error({ message: 'sendVerifyEmail(): ' + err.message })
        }

        return { code: 'suc' };
    },
    sendVerifyEmailPW(to,sendYn){
        check([to], [String]);
        const user: User = Users.collection.findOne({'emails.address': to}) as User;
        if(!user) {
            return {code: ResultCode.NOTFOUND};
        }
        let certNumber = commonSvc.randomNum(6);
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNumber;
        cert.target = to;
        cert.certType = Const.FIND_PWD_NO_PHONE_USER;
        CertsColls.collection.insert(cert);
        this.unblock();

        try {
            if(sendYn) {
                Email.send({
                    to: to,
                    from: Meteor.settings.private.email.senderAlias,
                    subject: "[벤타스비트] 비밀번호 찾기 인증번호입니다.",
                    html: SSR.render('emailcertpw', {certKey: certNumber})
                });
            }
        } catch(err) {
            LogUtil.error({message: err.message})
        }
        return {code: 'suc'};
    },
    resetPWD(email: string, certId: string, passwd: string, type: string) {
        let cert: Cert = {
            _id: certId,
            // 테스트 계정 패스워드 변경 때문에 어쩔 수 없이..
            // userId: email,
            certType: type,
            certYn: true
        } as Cert;
        
        cert = CertsColls.collection.findOne(cert) as Cert;
        
        if (!cert) {
            console.log("no cert");
            return { code: ResultCode.NOTFOUND };
        }
        if (!commonSvc.checkPasswd(passwd)) {
            return { code: ResultCode.ERROR, "msg": "패스워드가 올바르지 않습니다." };
        }

        let user: any = Users.findOne({ 'emails.address': email });
        Accounts.setPassword(user._id, passwd);

        return { code: ResultCode.SUC };
    },
    verifyEmailAddress(to) {
        check([to], [String]);
        const exist: User = Users.collection.findOne({ 'emails.address': to }) as User;
        if (exist) {
            return { code: ResultCode.EXIST_ERR, country:exist.profile };
        }
        return { code: 'suc' };
    }, 
    /**
     * 인증번호 확인
     * @param to 
     * @param code 
     */
    verifyCert(to, code, certType? : string) {
        try {
            check([to, code], [String]);
            let cert: Cert = {} as Cert;
            cert.certNo = code;
            cert.target = to;
            cert.certType = Const.CATE_EMAIL_VERI;
            if(certType){
                cert.certType = certType;
            }
            cert = CertsColls.collection.findOne(cert) as Cert;
            if (!cert || cert.certYn) {
                return { code: ResultCode.NOTFOUND };
            } else if (cert.certYn) {
                return { code: ResultCode.EXIST_ERR };
            }
            cert = commonSvc.getNewObj(cert, true);
            cert.certYn = true;
            CertsColls.collection.update({ _id: cert._id }, { $set: cert });
            return { code: ResultCode.SUC, certId: cert._id, email: cert.target };
        } catch (exception) {
            throw exception;
        }
    },
    verifyCertPW(to,code){
        try{
            check([to, code], [String]);

            let cert: Cert = {} as Cert;
            cert.certNo = code;
            cert.target = to;
            cert.certType = Const.FIND_PWD_NO_PHONE_USER;
            cert = CertsColls.collection.findOne(cert) as Cert;

            if(!cert || cert.certYn){
                return {code: ResultCode.NOTFOUND};
            }else if(cert.certYn){
                return {code: ResultCode.EXIST_ERR};
            }

            cert = commonSvc.getNewObj(cert, true);
            cert.certYn = true;
            CertsColls.collection.update({_id: cert._id}, {$set: cert});
            return {code: ResultCode.SUC, certId: cert._id, email: cert.target, certType: cert.certType};
        
        }catch(exception){
            throw exception;
        }
    },
    checkLoginCert(email, certnum, countryCode : string){
        // find 후 remove
        LogUtil.info({i : 'checkLoginCert()'},true);

        try{
            // 1. 파라미터 형식 체크
            check([email, certnum], [String]);

            try {
                // 2. 인증객체 확인
                let cert: Cert = {} as Cert;
                cert.certNo = certnum;
                cert.target = email;
                cert.certType = undefined;
                switch (countryCode) {
                    case 'cn':
                        cert.certType = Const.CN_CATE_LOGIN;
                        break;
                    case 'kr':
                        cert.certType = Const.CATE_LOGIN;
                        break;
                }
                cert = CertsColls.collection.findOne(cert) as Cert;
                if(!cert){
                    return {code: ResultCode.NOTFOUND};
                }
    
                CertsColls.collection.remove({target : cert.target , certType : cert.certType});

            } catch (err) {
                LogUtil.error({e : 'checkLoginCert(). exception. 로그인인증실패 ' + err.message});
                return { code : ResultCode.ERROR };
            }
            
            return {code: ResultCode.SUC};
        }catch(exception){
            throw exception;
        }
    },
    // 출금 이메일 인증번호 확인
    checkTransferCert(email : string, certnum : any, countryCode : string){
        LogUtil.info({i : 'checkTransferCert() '}, true);

        try{
            // 1. 파라미터 형식 체크
            check([email, certnum], [String]);

            try {
                // 2. 인증객체 확인
                let cert: Cert = {} as Cert;
                cert.certNo = certnum;
                cert.target = email;
                cert.certType = undefined;
                switch (countryCode) {
                    case 'cn':
                        cert.certType = Const.CN_CATE_TRANSFER;
                        break;
                    case 'kr':
                        cert.certType = Const.CATE_TRANSFER;
                        break;
                }
                cert = CertsColls.collection.findOne(cert) as Cert;
                
                if(!cert){
                    return {code: ResultCode.NOTFOUND};
                }
    
                CertsColls.collection.remove({target : cert.target , certType : cert.certType});

            } catch (err) {
                LogUtil.error({e : 'checkTransferCert(). exception. 입출금인증실패 ' + err.message});
                return { code : ResultCode.ERROR };
            }
            
            return {code: ResultCode.SUC};
        }catch(exception){
            throw exception;
        }
    },
    /**
     * 
     * @param email : 사용자 이메일
     * @param infoType : 바뀐정보 (ex : 비밀번호, 계좌번호 , ...)
     * @param countryCode : 국가코드
     */
    sendUserInfochangeCompleteMail(email : string, infoType : string, countryCode : string){
        check([email], [String]);
        
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }

        switch (countryCode) {
            case 'cn':
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您变更会员信息';
                obj.html = SSR.render('cn_userinfo_change', {infoType: infoType})
                break;
            case 'kr':
                obj.subject = '[벤타스비트] 회원정보가 변경되었습니다.';
                obj.html = SSR.render('kr_userinfo_change', {infoType: infoType})
                break;
        }
        
        try {
            Email.send(obj);
        } catch(err) {
            LogUtil.error({message: err.message})
        }
        return {code: 'suc'};
    },
    checkUserSecessionCert(email, certnum, countryCode : string){
        LogUtil.info({i : 'checkUserSecessionCert()'},true);

        try{
            // 1. 파라미터 형식 체크
            check([email, certnum], [String]);

            try {
                // 2. 인증객체 확인
                let cert: Cert = {} as Cert;
                cert.certNo = certnum;
                cert.target = email;
                cert.certType = undefined;
                switch (countryCode) {
                    case 'cn':
                        cert.certType = Const.CN_CATE_SECESSION;
                        break;
                    case 'kr':
                        cert.certType = Const.CATE_SECESSION;
                        break;
                }
                cert = CertsColls.collection.findOne(cert) as Cert;
                if(!cert){
                    return {code: ResultCode.NOTFOUND};
                }

            } catch (err) {
                LogUtil.error({e : 'checkUserSecessionCert(). exception. 회원탈퇴인증실패 ' + err.message});
                return { code : ResultCode.ERROR };
            }
            
            return {code: ResultCode.SUC};
        }catch(exception){
            throw exception;
        }
    },
    /**
     * 회원가입
     * @param user 
     */
    async registUser(user: any, certType? : string) {
        user.email = user.email.replace(/\s/gi, '');
        let cert: Cert = {
            _id: user.certId,
            target: user.email,
            certType: Const.CATE_EMAIL_VERI,
            certYn: true
        } as Cert;
        if(certType){
            cert.certType = certType;
        }
        let UserAliasCode = EventService.createUserAlias();
        cert = CertsColls.collection.findOne(cert) as Cert;
        if (!cert) {
            return { code: ResultCode.NOTFOUND };
        }

        let profile = {            
            alias: UserAliasCode,
            bankYn: 'N',
            bankInfo: {
                no: '',
                code: '',
                name: '',
                ownerName: ''
            }
        };

        let current = new Date();
        _.each(user.agree, (value) => {
            value.time = current;
        });
        profile['agree'] = user.agree;
        profile['lvl'] = 'A';
        profile['country'] = user.country;
        //TODO 필수약관 동의 여부 확인.
        let userId;
        try {
            userId = Accounts.createUser({ email: user.email, password: user.password, profile: profile });
        } catch (e) {
            throw e;
        }
        
        if (!userId) {
            return { code: ResultCode.ERROR, msg: '사용자 생성에 실패했습니다.' };
        }

        let result = await UserWalletService.createAllWallets(userId,user.country);
        if (!result.code || result.code != 200) {
            LogUtil.error({ e: 'registUser(): creating userwallet is failed.' })
        }
        
        // 가입축하 이메일전송
        if(certType == "cn/email/register" || certType == 'kr/email/register'){
            Meteor.call('emailForRegistComplete',user.email, user.country);
        }
        return { code: ResultCode.SUC };
    },
    saveUserToken(userId : string, fcmToken : string){
        if(!userId || !fcmToken || fcmToken == null){
            return;
        }
        
        return FCMService.saveUserToken(userId,fcmToken);
    }
});

// 로그인 시 동작
Accounts.onLogin((options) => {

    // 로그인일때만 실행하도록. 
    // 세션 재연결 시 'resume' 이 뜸 (새로고침 할때도.)
    if (options.type != 'password') {
        return;
    }

    var currentToken = Accounts['_getLoginToken'](options.connection.id);
    if (!currentToken) {
        return;
    }
    
    HookHelper.prototype.createLoginLog('login', options.user._id, options.connection).then(history => {
        HistoryCollection.update({ _id: currentToken }, { $set: history }).subscribe(async (number) => {
            //신규로그인
            if (number > 0 || !history) {
                return;
            }
            history._id = currentToken;
            history.create = new Date();
            let setUserHistory;
            let result ;
            try {
                result = await HistoryCollection.findOne({netid : history.netid});
                if(result){
                    return;
                }
                setUserHistory = await HistoryCollection.insert(history).first().toPromise();
                if(setUserHistory){
                   await UserInfoHistoryService.setUserLoginHistory(history._id);
                }
            } catch (err) {
                LogUtil.error({ e : 'After_Login, HistoryCollection insert exception. ' + err.message , history});
                return;
            }
            
            // 로그인 알림 이메일 발송. 중국용 이메일함수 필요
            // let user = options.user;
            // await Meteor.call('loginEmail', user, history);
        });
    });
});

export class HookHelper {
    async createLoginLog(type: string, id: string, connection: any) {
        let ip = ''

        if (connection.httpHeaders['x-forwarded-for']) {
            const tmp = connection.httpHeaders['x-forwarded-for'].split(',');
            ip = tmp[0];
        } else {
            ip = connection.clientAddress;
        }
        const locale = await ServerUtil.getIpCounty(ip);

        if (!locale) {
            return undefined;
        }

        let history: any = {
            category: type,
            last: new Date(),
            netid: connection.id,
            owner: id,
            agent: connection.httpHeaders['user-agent'],
            ip: ip,
            country: locale.country,
            countryName: locale.name,
            data: connection
        };
        return history;
    }
}