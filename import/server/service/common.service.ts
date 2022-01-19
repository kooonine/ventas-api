import { Meteor } from 'meteor/meteor';

export class CommonService {
    static getLogger() {

    }
    //TODO
    //slack noti...
    errorNoti(...args: any[]) {
        console.log("errorNoti", args);
    }

    readonly NUMBERS = '0123456789';
    randomNum(len: number) {
        let result = '';
        for (let i = 0; i < len; i++) {
            var rnum = Math.floor(Math.random() * this.NUMBERS.length);
            var randomnumber = parseInt(this.NUMBERS.substring(rnum, rnum + 1));
            result += randomnumber;
        }
        return result;
    }
    getNewObj(obj?: any, isUpdate?: any) {
        let result: any;
        if (obj) {
            result = obj;
        } else {
            result = {};
        }
        if (isUpdate) {
            result.upUser = Meteor.userId();
            result.upDt = new Date();
        } else {
            result.inUser = Meteor.userId();
            result.inDt = new Date();
        }
        return result;
    }
    checkPasswd(inputtxt) {
        if (!inputtxt)
            return false;
        // var paswd = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,20}$/; //기존 정규식
        var paswd = /^(?=.*?[a-z]{1,})(?=.*?[0-9]{1,})(?=.*?[#?!@$%^&*-]{1,}).{8,20}$/g; //web common-svc checkPasswd 정규식

        if (inputtxt.match(paswd)) {
            return true;
        }
        else {
            return false;
        }
    }

    validateEmail(email) {
        if (!email)
            return false;
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email.toLowerCase());
    }
    /**
     * 요청이 큐서버로 부터인지 확인한다.
     */
    allowApi(req: any) {

        //TODO 
        //서버 접근키를 생성하고 관리해야 한다.
        //queue 등의 인증된 서버만 URL에 접속할수 있도록 한다.

        return true;
    }

}

export const commonSvc = new CommonService();