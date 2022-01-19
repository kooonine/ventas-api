import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Cert, User } from "../models";
// import { commonSvc } from '../services';
import { CertsColls } from '../collections/cert.collection';
import { Users, UserWalletCollection, CompanyAssetCollection } from '../collections';
import { ResultCode, Const } from '../models';
import { SSR } from 'meteor/meteorhacks:ssr';
import { Email } from 'meteor/email';
import { LogUtil, ServerUtil } from '../lib';
import { commonSvc } from '../service';

/**
 * TODO
 * SSR 컴파일 오류 발생한다.
 * 발생해도 동작한다. ssr 클래스의 import 방식을 확인할것,
 */

SSR.compileTemplate('emailcert', Assets.getText('email-cert.html'));
SSR.compileTemplate('emailevent', Assets.getText('email-event.html'));
SSR.compileTemplate('emailcertpw', Assets.getText('email-certpw.html'));
SSR.compileTemplate('login_email', Assets.getText('email-login.html'));
SSR.compileTemplate('kr_register_email_cert', Assets.getText('kr-email-register-cert.html'));
SSR.compileTemplate('kr_transfer_email_cert', Assets.getText('kr-email-transfer-cert.html'));
SSR.compileTemplate('kr_register_email_finish', Assets.getText('kr-email-register-finish.html'));
SSR.compileTemplate('kr_login_email_cert', Assets.getText('kr-email-login-cert.html'));
SSR.compileTemplate('kr_user_secession', Assets.getText('kr-email-secession.html'));
SSR.compileTemplate('kr_user_secession_cert', Assets.getText('kr-email-secession-cert.html'));

// 중국
SSR.compileTemplate('cn_login_email_cert', Assets.getText('cn-email-login-cert.html'));
SSR.compileTemplate('cn_register_email_cert', Assets.getText('cn-email-register-cert.html'));
SSR.compileTemplate('cn_register_email_finish', Assets.getText('cn-email-register-finish.html'));
SSR.compileTemplate('cn_transfer_email_cert', Assets.getText('cn-email-transfer-cert.html'));
SSR.compileTemplate('cn_user_secession', Assets.getText('cn-email-secession.html'));
SSR.compileTemplate('cn_user_secession_cert', Assets.getText('cn-email-secession-cert.html'));
Meteor.methods({
    /* 로그인 시 이메일 발송 */
    loginEmail(user, history) {
        if (!user || !history) {
            return { code: ResultCode.ERROR_INVALID_PARAM };
        }

        let userEmail = user.emails[0].address;
        
        check([userEmail], [String]);

        try {
            let dayString = ['일', '월', '화', '수', '목', '금', '토'];

            let loginDate = history.last.getFullYear() + '-' + 
                ((history.last.getMonth() + 1) < 10 ? '0' + (history.last.getMonth() + 1) : (history.last.getMonth() + 1)) + '-' + 
                (history.last.getDate() < 10 ? '0' + history.last.getDate() : history.last.getDate()) + '(' + dayString[history.last.getDay()] + ') ' +
                (history.last.getHours() < 10 ? '0' + history.last.getHours() : history.last.getHours()) + ':' + 
                (history.last.getMinutes() < 10 ? '0' + history.last.getMinutes() : history.last.getMinutes());

                
            let country = history.country;
            let countryName = history.countryName =='undefined undefined'? undefined : history.countryName;

            let device = '';
            if (history['agent'].indexOf('Windows') > 0) {
                device = 'Windows';
            }

            let agent = '';

            if (history['agent'].indexOf('Chrome') > 0) {
                agent = 'Chrome';
            }

            if (history['agent'].indexOf('Trident') > 0) {
                agent = 'Internet Explorer';
            }

            if (history['agent'].indexOf('Whale') > 0) {
                agent = 'Whale';
            }

            if (history['agent'].indexOf('Edge') > 0) {
                agent = 'Edge';
            }

            if(!history.ip || !history.country || !history.countryName){
                return;
            }

            Email.send({
                to: userEmail,
                from: Meteor.settings.private.email.senderAlias,
                subject: "[벤타스비트] 로그인 안내.",
                html: SSR.render('login_email', { email: userEmail, inDt: loginDate, ip: history.ip, country: country, countryName : countryName, device: device, agent: agent })
            });

        } catch (err) {
            LogUtil.error({ e: 'loginEmail(): ' + err.message })
        }

        return { code: 'suc' };
    },
    // 로그인 인증 이메일 발송
    emailCertForLogin(email : string , countryCode: string){
        check([email], [String]); // 이메일형식체크

        LogUtil.info({ i : 'emailCertForLogin().'},true);
        // 1. 유효한 사용자인지 확인
        try {
            const user: User = Users.collection.findOne({'emails.address': email}) as User;
            
            if(!user) {
                LogUtil.error({ e : 'emailCertForLogin(). User not found...'});
                return {code: ResultCode.NOTFOUND};
            }
        } catch (err) {
            LogUtil.error({ e : 'emailCertForLogin(). exception. ' + err.message});
            return {code: ResultCode.ERROR};
        }

        // 2. 랜덤번호생성
        let certNumber = commonSvc.randomNum(6); // 인증번호 생성

        // 3. certCollection 에 저장
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNumber;
        cert.target = email;
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                cert.certType = Const.CN_CATE_LOGIN;
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您登录验证码';
                obj.html = SSR.render('cn_login_email_cert', {certKey: certNumber});
                break;
            case 'kr':
                cert.certType = Const.CATE_LOGIN;
                obj.subject = '[벤타스비트] 로그인 인증번호입니다.';
                obj.html = SSR.render('kr_login_email_cert', {certKey: certNumber});
                break;
        }

        CertsColls.collection.insert(cert);

        // 4. 이메일보내기
        try {
            Email.send(obj);
        } catch(err) {
            LogUtil.error({e: "emailCertForLogin(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }
        return {code: 'suc'};
    },
    
    // 회원가입 인증 메일 발송
    emailCertForRegist(email : string, countryCode : string){
        check([email], [String]); // 이메일형식체크

        LogUtil.info({ i : 'emailCertForRegist().'},true);
        // 1. 유효한 사용자인지 확인
        try {
            const user: User = Users.collection.findOne({'emails.address': email}) as User;
            
            if(user) {
                LogUtil.error({ e : 'emailCertForRegist(). User already Exist.'});
                return {code: ResultCode.EXIST};
            }
        } catch (err) {
            LogUtil.error({ e : 'emailCertForRegist(). exception. ' + err.message});
            return {code: ResultCode.ERROR};
        }

        // 2. 랜덤번호생성
        let certNumber = commonSvc.randomNum(6); // 인증번호 생성

        // 3. certCollection 에 저장
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNumber;
        cert.target = email;
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                cert.certType = Const.CN_CATE_REGIST;
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您注册电子邮箱验证码';
                obj.html = SSR.render('cn_register_email_cert', {certKey: certNumber});
                break;
            case 'kr':
                cert.certType = Const.CATE_REGIST;
                obj.subject = '[벤타스비트] 회원가입 이메일 인증번호입니다.';
                obj.html = SSR.render('kr_register_email_cert', {certKey: certNumber});
                break;
        }

        CertsColls.collection.insert(cert);

        // 4. 이메일보내기
        try {
            Email.send(obj);
        } catch(err) {
            LogUtil.error({e: "emailCertForRegist(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }
        return {code: 'suc'};
    },
    // 회원가입 축하이메일 발송
    emailForRegistComplete(email : string, countryCode : string){
        LogUtil.info({ i : 'emailForRegistComplete'},true);

        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                obj.subject = '[Ventas Wiserasset Company Limited] 恭喜您注册';
                obj.html = SSR.render('cn_register_email_finish');
                break;
            case 'kr':
                obj.subject = '[벤타스비트] 회원가입을 축하드립니다.';
                obj.html = SSR.render('kr_register_email_finish');
                break;
        }

        // 1. 회원가입 축하메일 전송
        try {
            Email.send(obj);
        } catch(err) {
            LogUtil.error({e: "emailForRegistComplete(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }
        
        return { code: ResultCode.SUC };
    },
    // 입출금 인증 이메일 발송
    emailForTransfer(email : string, countryCode : string){
        LogUtil.info({ i : 'emailForTransfer' } , true);
        
        // 1. 랜덤번호생성
        let certNumber = commonSvc.randomNum(6);

        // 2. certCollections에 저장
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNumber;
        cert.target = email;
        
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                cert.certType = Const.CN_CATE_TRANSFER;
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您取款验证码';
                obj.html = SSR.render('cn_transfer_email_cert', {certKey: certNumber});
                break;
            case 'kr':
                cert.certType = Const.CATE_TRANSFER;
                obj.subject = '[벤타스비트] 출금 인증번호입니다.';
                obj.html = SSR.render('kr_transfer_email_cert', {certKey: certNumber});
                break;
        }

        CertsColls.collection.insert(cert);

        // 3. 이메일보내기
        try {
            Email.send(obj);
        } catch (err) {
            LogUtil.error({e: "emailForTransfer(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }

        return { code : ResultCode.SUC };
    },
    // 회원탈퇴 알림 이메일발송
    emailForUserSecession(email : string, countryCode : string){
        LogUtil.info({ i : 'emailForUserSecession()' } , true);
        
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您取款验证码';
                obj.html = SSR.render('cn_user_secession');
                break;
            case 'kr':
                obj.subject = '[벤타스비트] 회원탈퇴가 완료되었습니다.';
                obj.html = SSR.render('kr_user_secession');
                break;
        }

        try {
            Email.send(obj);
        } catch (err) {
            LogUtil.error({e: "emailForUserSecession(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }

        return { code : ResultCode.SUC };
    },
    // 회원탈퇴 인증이메일 발송
    emailForUserSecessionCert(email : string, countryCode : string){
        check([email], [String]); // 이메일형식체크

        LogUtil.info({ i : 'emailForUserSecessionCert().'},true);

        // 1. 랜덤번호생성
        let certNumber = commonSvc.randomNum(6); // 인증번호 생성

        // 2. certCollection 에 저장
        let cert: Cert = commonSvc.getNewObj() as Cert;
        cert.certNo = certNumber;
        cert.target = email;
        let obj = {
            to : email,
            from : Meteor.settings.private.email.senderAlias,
            subject : '',
            html : undefined
        }
        
        switch (countryCode) {
            case 'cn':
                cert.certType = Const.CN_CATE_SECESSION;
                obj.subject = '[Ventas Wiserasset Company Limited] 通知您会员注销电子邮箱验证码';
                obj.html = SSR.render('cn_user_secession_cert', {certKey: certNumber});
                break;
            case 'kr':
                cert.certType = Const.CATE_SECESSION;
                obj.subject = '[벤타스비트] 회원탈퇴 이메일 인증번호입니다.';
                obj.html = SSR.render('kr_user_secession_cert', {certKey: certNumber});
                break;
        }

        CertsColls.collection.insert(cert);

        // 3. 이메일보내기
        try {
            Email.send(obj);
        } catch(err) {
            LogUtil.error({e: "emailForUserSecessionCert(). sendMail exception. " + err.message});
            return {code: ResultCode.ERROR};
        }
        return {code: 'suc'};
    },
});

