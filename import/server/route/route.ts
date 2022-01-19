
import { Router } from 'meteor/iron:router';
import { ServerUtil } from '../lib/server.util';
import { CertsColls, Users, UserWalletCollection } from '../collections';
import { User, UserWallet, LockType } from '../models';
import { CoinService, TransferService } from '../service';
import { LogUtil } from '../lib';

const nice = Assets.getText('nice.html');

//실패.
Router.route('/nice/fail', function () {
    var req = this.request;
    var res = this.response;
    var json = req.body;
    let enc = req.body.EncodeData;
    ServerUtil.decodeNice(enc).then((value) => {
        const id = value['REQ_SEQ'];
        const cert = CertsColls.findOne({ _id: id });
        if (!cert) {
            return;
        }
        CertsColls.update({ _id: id }, { $set: { certYn: false, status: 'fail' } });
    });
    res.end(nice);
}, { where: 'server' });
//성공
Router.route('/nice/suc', function () {
    var req = this.request;
    var res = this.response;

    let enc = req.body.EncodeData;
    ServerUtil.decodeNice(enc).then((value) => {
        const id = value['REQ_SEQ'];
        const cert = CertsColls.findOne({ _id: id });
        if (!cert) {
            return;
        }

        cert.certYn = true;
        cert['cert'] = null;
        let user = Users.findOne({ _id: cert.userId });
        if (!user) {
            res.end("<script>alert('failed.');window.close();</script>");
            return;
        }

        let foundUser: User = Users.findOne({ 'profile.phoneNo': value.MOBILE_NO });
        if (foundUser) {
            res.end("<script>alert('duplicated phone number.');window.close();</script>");
            CertsColls.update({ _id: id }, { $set: { certYn: false, status: 'fail', errorCode : 1 } });
            return;
        }

        let checkBirth = Number(value['BIRTHDATE'].substring(0, 4)); // 사용자 나이
        let atLeastBirth = new Date().getFullYear() - 19; // 거래소 이용 최소 나이
        if (atLeastBirth < checkBirth) {
            CertsColls.update({ _id: id }, { $set: { certYn: false, status: 'fail', errorCode : 2 } });
            res.end("<script>alert('the minor can`t use this service.');window.close();</script>");
            return;
        }

        let profile = user['profile'];

        profile.phoneNo = value['MOBILE_NO'];
        profile.phoneCO = value['MOBILE_CO'];
        profile.gender = value['GENDER'];
        profile.birthday = value['BIRTHDATE'];
        profile.nation = value['NATIONALINFO'];
        profile.username = value['NAME'];
        profile.nickname = value['NAME'];
        profile.lvl = "B";

        profile.phoneCert = cert;

        Users.update({ _id: cert.userId }, { $set: { profile: profile, ip: req.connection.ip } });

        CertsColls.update({ _id: id }, { $set: { certYn: true, status: 'suc', response: value } });
        res.end(nice);
    });
}, { where: 'server' });
//성공,회원가입전
Router.route('/nice/suc-reg', function () {
    var req = this.request;
    var res = this.response;

    let enc = req.body.EncodeData;
    ServerUtil.decodeNice(enc).then((value) => {
        const id = value['REQ_SEQ'];
        const cert = CertsColls.findOne({ _id: id });
        if (!cert) {
            res.end("<script>alert('fail : it is duplicated phone number.');window.close();</script>");
            CertsColls.update({ _id: id }, { $set: { certYn: false, status: 'fail' } });
            return;
        }

        // 여기서 기존 회원이 있다면 인증 실패로.        
        let foundUser: User = Users.findOne({ 'profile.phoneNo': value.MOBILE_NO });
        if (foundUser) {
            res.end("<script>alert('fail : it is duplicated phone number.');window.close();</script>");
            CertsColls.update({ _id: id }, { $set: { certYn: false, status: 'fail' } });
            return;
        }

        CertsColls.update({ _id: id }, { $set: { certYn: true, status: 'suc', response: value, rep: cert } });
        res.end(nice);
    });
}, { where: 'server' });
Router.route('/nice/suc-findId', function () {
    var req = this.request;
    var res = this.response;

    let enc = req.body.EncodeData;
    ServerUtil.decodeNice(enc).then((value) => {
        const id = value['REQ_SEQ'];
        const cert = CertsColls.findOne({ _id: id });
        if (!cert) {
            res.end("<script>alert('cert Failed..');window.close();</script>");
            return;
        }

        let foundUser: User = Users.findOne({ 'profile.phoneNo': value.MOBILE_NO });
        let userId = '';
        let testUserId = '';
        if (foundUser) {
            userId = foundUser.emails[0].address;
            testUserId = foundUser.profile['testId'];
        }

        CertsColls.update({ _id: id }, { $set: { certYn: true, status: 'suc', response: value, rep: cert, userId: userId, testUserId: testUserId } });
        res.end(nice);
    });
}, { where: 'server' });
// Router.route('/blk/:_coinCode/:_txhash/:_kind/:_privateKey', async function (param: any) {
//     LogUtil.info({ i: ' receivedTx: ' + this.params._coinCode + '[' + this.params._txhash + '][' + this.params._kind + ']' });
//     if (!this.params._privateKey || this.params._privateKey != 'Vent@sPriv@teKey12291!') {
//         LogUtil.error({ e: 'privateKey is invalid.', privateKey: this.params._privateKey });
//         this.response.end();
//         return;
//     }

//     let blknotiLock;

//     try {
//         // 작업의 동시성 제어를 위한 blknoti queue
//         blknotiLock = await ServerUtil.getLock(LockType.blknoti, this.params._coinCode, 3000);

//         // tx 확인
//         await CoinService.checkTransaction(this.params._coinCode, this.params._txhash, this.params._kind);

//     } catch (err) {
//         LogUtil.error({ e: 'coinRouter(): ' + err.message })
//     } finally {
//         if (blknotiLock) {
//             blknotiLock.unlock();
//         }

//         this.response.end();
//     }

// }, { where: 'server' });