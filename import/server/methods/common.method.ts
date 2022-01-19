import { Users, CompanyAssetCollection, UserWalletCollection, EventTradingCollection, EventListCollection, TradeCollection } from "../collections";
import { HomeService, DailyFiatService, UserWalletService, TradeService , MyassetService, CompanyAssetService, IEOService, TransferService, AuthService, EventService, VoteService, UserInfoHistoryService } from "../service";
import { RedisService } from "../service/redis.service";
import { LogUtil, ServerUtil } from "../lib";
import { ResultCode, LockType, CompanyAsset, ReadPref, Question, ContactUs, Vote } from "../models";
import { OrderService } from "../service/order.service";
import { UserService } from "../service/user.service";
import { AddressBookService } from "../service/address.book.service";
import { QuestionService } from "../service/question.service";
import { NoticeService } from "../service/notice.service";
import { ContactUsService } from "../service/contact.us.service";
import { FaqService } from "../service/faq.service";
import { IndicatorsService } from "../service/indicators.service";

Meteor.methods({

    mainPage(country : string){
        return HomeService.mainPage(country);
    },

    modifyOrder(id: string, amount: number, price: number) {
        if (!Meteor.userId()) {
            LogUtil.error({ e: '로그인 없이 주문 요청.' });
            return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 신청에 실패하였습니다.' }
        }

        let userId = Meteor.userId();
        LogUtil.info({ i: ' modifyOrder ', orderId: id, amount, price, userId });

        return OrderService.modifyOrder(id, amount, price, userId);
    },

    createOrder(receivedOrder: any) {
        if (!Meteor.userId()) {
            LogUtil.error({ e: '로그인 없이 주문 요청.' });
            return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 신청에 실패하였습니다.' }
        }
        receivedOrder.userId = Meteor.userId();
        receivedOrder.country = Meteor.user().profile['country']; // 국가코드추가

        LogUtil.info({ i: ' createOrder ', receivedOrder });

        if (!CompanyAssetService.isTradePossible(receivedOrder.src, receivedOrder.target)) {
            LogUtil.error({ e: ' createOrder(can not trade)', receivedOrder });
            return { code: ResultCode.ERROR }
        }
    
        return OrderService.createOrder(receivedOrder);
    },

    cancelOrder(id: string, amount: number) {
        if (!Meteor.userId()) {
            LogUtil.error({ e: '로그인 없이 주문 요청.' });
            return { code: ResultCode.ERROR_INVALID_PARAM, msg: '주문 신청에 실패하였습니다.' }
        }

        LogUtil.info({ i: ' cancelOrder ', orderId: id, amount, userId: Meteor.userId() });

        return OrderService.cancelOrder(id, amount);
    },


    userInfo(id: string) {
        return UserService.getUserById(id);
    },

    CompanyAssetListCoin(counrty : string){
        return HomeService.CompanyAssetListCoin(counrty);
    },

    CompanyAssetList(market: string) {
        if (!market) { return } else {
            return HomeService.CompanyAssetList(market);
        }
    },
    CompanyAssetListALL(market: string) {
        if (!market) { return } else {
            return HomeService.CompanyAssetListALL(market);
        }
    },
    getCompanyAsset(market : string, target : string){
        return CompanyAssetService.getCompanyAsset(market,target);
    },

    coinDetail(market: string, target: string) {
        if (!market || !target) { return } else {
            return HomeService.coinDetail(market, target);
        }
    },

    //관심 코인 리스트
    // favoriteCoin(src : string, userId : string) {
    //     return HomeService.favoriteCoin(src,userId);
    // },

    favoriteCoin(userId: string, keyword) {
        return HomeService.favoriteCoin(userId, keyword);
    },
    renewalFavoriteCoin(userId: string, keyword:string, src : string){
        return HomeService.renewalFavoriteCoin(userId, keyword, src);
    },

    addFavorite(src: string, code: string, name: string, userId: string) {
        if(!Meteor.userId()){
            return { code: ResultCode.ERROR };            
        }        

        return HomeService.addFavorite(src, code, name, userId);
    },

    removeFavorite(src: string, code: string, userId: string) {
        return HomeService.removeFavorite(src, code, userId);
    },
    isMyFavoriteCoin(src : string, code : string, userId : string){
        return HomeService.isMyFavoriteCoin(src, code, userId);
    },
    isMyPossesionCoin(code : string, userId : string){
        return HomeService.isMyPossesionCoin(code , userId);
    },
    getMyCoinList(userId: string, keyword) {
        return HomeService.getMyCoinList(userId, keyword);
    },
    getMyCoinListCode(userId : string){
        return HomeService.getMyCoinListCode(userId);
    },

    coinSearch(src: string, keyword: string) {
        return HomeService.coinSearch(src, keyword);
    },

    realTimeInfo(src: string, target: string, limit: number) {
        return RedisService.getFiatRateListByLimit(src, target, limit);
    },

    ///호가 영역
    sellList(setKind: string, setSrc: string, setTarget: string, limit: number) {
        LogUtil.info({ console: 'sellList' }, true);
        return HomeService.getSellOrderList(setKind, setSrc, setTarget, limit);
    },
    buyList(setKind: string, setSrc: string, setTarget: string, limit: number) {
        LogUtil.info({ console: 'buyList' }, true);
        return HomeService.getBuyOrderList(setKind, setSrc, setTarget, limit);
    },

    dailyInfo(src: string, target: string, limit: number) {
        return DailyFiatService.getDailyFiatListWithinYear(src, target, limit);
    },
    
    getFiatrateByTs(market: string, target: string, fromTs: number, toTs: number) {
        return RedisService.getFiatrateByTs(market, target, fromTs, toTs);
    },
    getFiatrateByTs2(src : string , target: string, fromTs: number, toTs: number) {
        LogUtil.info({ console: 'getFiatrateByTs2' }, true);
        return RedisService.getFiatrateByTs2(src, target, fromTs, toTs);
    },

    //매도매수
    getUserAvailable(owner: string,assetCode: string) {        
        if (!Meteor.userId()) {return undefined;}
        return UserWalletService.getUserWallet(Meteor.userId(), assetCode);
    },

    // 잔고 - 체결내역
    tradeList(target : string, kind : string, limit : 30){
        LogUtil.info({ console: 'tradeList' }, true);
        return MyassetService.tradeList(target, kind, limit);
    },
    //미체결내역
    noTradeList(target : string, kind : string, limit : number){
        LogUtil.info({ console: 'noTradeList' }, true);
        
        let owner = Meteor.userId();
        
        if (!owner) {
            return [];
        }

        return OrderService.noTradeList(owner, target, kind, limit);
    },
    // 미체결내역(리뉴얼)
    notConcludedOrder(market : string, target : string, kind : string, limit? : number){
        LogUtil.info({ console: 'notConcludedOrder' }, true);

        let userId = Meteor.userId();

        if(!userId){
            return [];
        }

        return OrderService.notConcludedOrder(userId, market, target, kind, limit);
    },
    // 체결내역 (userHistoryCollection에서 가져오는 함수)
    concludedOrder(){
        LogUtil.info({ console: 'concludedOrder' }, true);
        
        let userId = Meteor.userId();
        
        if(!userId){
            return [];
        }
        
        return OrderService.concludedOrder(userId);
    },
    // 체결내역(리뉴얼)
    // concludedOrder(market : string, target : string, kind : string, limit? : number){
    //     LogUtil.info({ console: 'concludedOrder' }, true);

    //     let userId = Meteor.userId();

    //     if(!userId){
    //         return [];
    //     }

    //     return OrderService.concludedOrder(userId);
    // },
    // 사용자 지갑정보
    getAllUserWallet(){
        LogUtil.info({ console: 'getAllUserWallet. '}, true);
        
        let userId = Meteor.userId();
        if(!userId){
            return [];            
        }
        
        return UserWalletService.getAllUserWallet(userId);
    },

    // IEO 리스트
    getIEOList(code? : string, orderCount? : number){
        return IEOService.getIEOList(code, orderCount);
    },

    // IEO 의 구매자 수, 총 판매금액, 총 판매수량 리턴
    getIEOTotalTradingAmount(code : string){
        return IEOService.getIEOTotalTradingAmount(code);
    },

    // IEO 구매
    buyIEOCoin(orderInfo : any, ieoInfo : any){
        return IEOService.buyIEOCoin(orderInfo, ieoInfo);
    },

    getMyIEOHistory(assetCode : string){
        return IEOService.getMyIEOHistory(assetCode);
    },

    // 주소 생성
    getNewCoinAddress(assetCode: string) {        
        if (!Meteor.userId()) {
            return { code: ResultCode.ERROR };
        }

        if (!CompanyAssetService.isTransferPossible(assetCode)) {
            LogUtil.error({ e: ' makeCoinAddress(can not transfer)' });
            return { code: ResultCode.ERROR }
        }

        return UserWalletService.getNewCoinAddress(assetCode, Meteor.userId());
    },

    // { kind: string, toAddress: string, assetCode: string, amount: number destTag?: string}    
    createTransfer(receivedTransfer) {
        if (!Meteor.userId()) {
            return { code: ResultCode.ERROR }
        } 
        if (!CompanyAssetService.isTransferPossible(receivedTransfer.assetCode)) {
            LogUtil.error({ e: ' createTransfer(can not transfer)', receivedTransfer });
            return { code: ResultCode.ERROR }
        }

        LogUtil.info({ i: ' createTransfer ', receivedTransfer, user: Meteor.userId() });
        

        return TransferService.createTransfer(receivedTransfer);
    },

    // {assetCode: string, amount: number, email: string}
    createInternalTransfer(receivedTransfer: any) {
        if (!Meteor.userId()) {
            return { code: ResultCode.ERROR }
        }

        if (!CompanyAssetService.isTransferPossible(receivedTransfer.assetCode)) {
            LogUtil.error({ e: ' createInternalTransfer(can not transfer)', receivedTransfer });
            return { code: ResultCode.ERROR }
        }

        receivedTransfer.userId = Meteor.userId();
        LogUtil.info({ i: ' createInternalTransfer ', receivedTransfer, user: Meteor.userId() });
        
        return TransferService.createInternalTransfer(receivedTransfer);
    },
    
    getMyTransferList(assetCode: string, kind: string, limit: number, fromDt?: Date, atDt?: Date) {
        LogUtil.info({ console: 'getMyTransferList' }, true);
        
        if (!Meteor.userId()) {
            return [];
        }

        return TransferService.getMyTransferList(Meteor.userId(), assetCode, kind, limit, fromDt, atDt);
    },

    getMyLatelyTransferList(assetCode : string){
        LogUtil.info({ console: 'getMyLatelyTransferList' }, true);
        
        if (!Meteor.userId()) {
            return [];
        }

        return TransferService.getMyLatelyTransferList( assetCode);
    },

    getUserByEmail(email: string) {
        if (!email) {
            return undefined;
        }

        let user;
        try {
            user = Users.findOne({ 'emails.address': email });

            if (!user) {
                return undefined;
            }
        } catch (err) {
            LogUtil.error({ e: 'getUserByEmail(): ' + err.message });
            return;
        }

        return user
    },
    
    insertAddressBook(assetCode: string, address: string, addressName: string, destinationTag? : string){
        LogUtil.info({ console: 'insertAddressBook' }, true);

        return AddressBookService.insertAddressBook(assetCode,address,addressName,destinationTag);
    },
    
    getAddressBookList(assetCode : string){
        LogUtil.info({ console: 'getAddressBookList' }, true);

        return AddressBookService.getAddressBookList(assetCode);
    },

    getAddressBookListByUser(){
        LogUtil.info({ console: 'getAddressBookListByUser' }, true);
        
        return AddressBookService.getAddressBookListByUser(Meteor.userId());
    },
    
    removeAddressBook(id : string){
        LogUtil.info({ console: 'removeAddressBook', addressbook_id : id }, true);
        
        return AddressBookService.removeAddressBook(id);
    },

    modifyAddressBook(modifyAddress : any){
        LogUtil.info({ console: 'modifyAddressBook' }, true);
        
        return AddressBookService.modifyAddressBook(modifyAddress);
    },

    getUserWallets(owner: string) {
        LogUtil.info({ console: 'getUserWallets' }, true);
        return UserWalletCollection.find({ owner: owner, useYn: true }, { readPreference: ReadPref.SECONDARY_PREFERRED });;
    },

    updateUserAgree(agreeType: string, value: boolean){
        return UserService.updateUserAgree(agreeType,value);
    },
    
    checkUserSecessionAvailability(){
        return UserService.checkUserSecessionAvailability();
    },

    userSecession(){
        return UserService.userSecession();
    },

    createEnc(type : string, email : string, sucUrl, failUrl){
        return AuthService.createEnc(type,email,sucUrl,failUrl);
    },

    getMyLoginHistory(){
        LogUtil.info({ console: 'getMyLoginHistory' }, true);
        return AuthService.getMyLoginHistory();
    },

    getQuestionList(){
        LogUtil.info({ console: 'getQuestionList' }, true);
        return QuestionService.getQuestionList();
    },

    insertQuestion(question : Question){
        LogUtil.info({ console: 'insertQuestion' }, true);

        if (!Meteor.userId()) {
            LogUtil.error({ e: 'insertQuestion(): user not found.', question });
            return { code: ResultCode.ERROR };
        }

        return QuestionService.insertQuestion(question);
    },

    getNoticeList(noticeNo?: number) {
        LogUtil.info({ console: 'getNoticeList' }, true);
        return NoticeService.getNoticeList(noticeNo);
    },

    getCnNoticeList(noticeNo? : number){
        LogUtil.info({console: 'getCnNoticeList'},true);
        return NoticeService.getCnNoticeList(noticeNo);
    },
    
    eventInfo(eventNo : string){
        LogUtil.info({ console: 'eventInfo' }, true);
        return EventListCollection.findOne({eventNo:eventNo});
    },

    eventList(){
        LogUtil.info({ console: 'eventList' }, true);
        return EventListCollection.find({}, {sort : {inDt : -1}, readPreference: ReadPref.SECONDARY_PREFERRED });;
    },
    async eventCoinRanking(){
        LogUtil.info({ console: 'myTotalTradeVal' }, true);
        let eventTarget = ['6','7','8','9'];
        let eventCoinRankList = [];
        
        for(let i = 6 ; i < 10; i++){
            let evnetData = {};
            let evnetNo = i+'';
            evnetData = await EventTradingCollection.findOne({eventNo : evnetNo , eventTime : 'ALL' },{sort : {tradetotalPrice : -1}});
            eventCoinRankList.push(evnetData);
        }        
        return eventCoinRankList;

    },
    //190322 나의 누적거래대금
    async myTotalTradeVal(no) {
        LogUtil.info({ console: 'myTotalTradeVal' }, true);
        if (!Meteor.userId() || !no) { return }

        let eventInfo = await EventListCollection.findOne({eventNo : no});

        // let stDay = '2019-03-22 19:00:00:000';
        // let enDay = '2019-04-26 18:59:59:000';
        // let targetList = ['BLOOD', 'STI', 'VENC']

        let tradingList = [];
        let myTotalTradeVal = 0;
        tradingList = await TradeCollection.find({ $and: [{ $or: [{ owner: Meteor.userId() }, { orderOwner: Meteor.userId() }] }, { $and: [{ inDt: { $gte: eventInfo.stDt } }, { inDt: { $lt: eventInfo.enDt } }, { target: { $in: eventInfo['targets'] } }, { status: 60 }] } ] }, { readPreference: ReadPref.SECONDARY });
        for (let i = 0; i < tradingList.length; i++) {
            if (tradingList[i].orderOwner == Meteor.userId()) {
                myTotalTradeVal += (tradingList[i].amount * tradingList[i].price);
            }
            if (tradingList[i].owner == Meteor.userId()) {
                myTotalTradeVal += (tradingList[i].amount * tradingList[i].price);
            }
        }
        return myTotalTradeVal;
    },

    //190322 나의 누적거래대금
    async myWeekTradeVal(no) {
        LogUtil.info({ console: 'myWeekTradeVal' }, true);
        if (!Meteor.userId() || !no) { return }
        let eventInfo = await EventListCollection.findOne({eventNo : no});

        let stDt = eventInfo.stDt;
        let enDt = eventInfo.enDt;

        let stDay :Date; //eventInfo.stDt
        let enDay :Date;//eventInfo.enDt
        //let eventTimeline = Number(((enDt.getTime() -  stDt.getTime()) / 604800000).toFixed(0));    
        
        let now = new Date();
        
        let tradingList = [];
        let myWeekTradeVal = 0;

        if(enDt < now){
            stDay = new Date(enDt.getTime() - 604800000); enDay = enDt;
        }else if(new Date(enDt.getTime() - 604800000) < now  && enDt >= now ) {
            stDay = new Date(enDt.getTime() - 604800000); enDay = enDt;
            
        }else if(new Date(enDt.getTime() - (604800000*2)) < now  && new Date(enDt.getTime() - (604800000*1)) >= now ) {
            stDay = new Date(enDt.getTime() - (604800000 * 2)) ;  enDay =  new Date(enDt.getTime() - 604800000 );
        }else if(new Date(enDt.getTime() - (604800000*3)) < now  && new Date(enDt.getTime() - (604800000*2)) >= now ) {
            stDay = new Date(enDt.getTime() - (604800000 * 3)) ;  enDay =  new Date(enDt.getTime() - (604800000*2) );
        }
        else if(new Date(enDt.getTime() - (604800000*4)) < now  && new Date(enDt.getTime() - (604800000*3)) >= now ) {
            stDay = new Date(enDt.getTime() - (604800000 * 4)) ;  enDay =  new Date(enDt.getTime() -(604800000*3) );
        }
        else if(new Date(enDt.getTime() - (604800000*5)) < now  && new Date(enDt.getTime() - (604800000*4)) >= now ) {
            stDay = new Date(enDt.getTime() - (604800000 * 5)) ;  enDay =  new Date(enDt.getTime() - (604800000*4) );
        }
        

        tradingList = await TradeCollection.find({ $and: [{ $or: [{ owner: Meteor.userId() }, { orderOwner: Meteor.userId() }] },{ $and: [{ inDt: { $gte: stDay } }, { inDt: { $lt: enDay } }, { target: { $in: eventInfo['targets'] } }, { status: 60 }] }] }, { readPreference: ReadPref.SECONDARY });
        for (let i = 0; i < tradingList.length; i++) {
            if (tradingList[i].orderOwner == Meteor.userId()) {
                myWeekTradeVal += (tradingList[i].amount * tradingList[i].price);
            }
            if (tradingList[i].owner == Meteor.userId()) {
                myWeekTradeVal += (tradingList[i].amount * tradingList[i].price);
            }
        }
        return myWeekTradeVal;
    },

    //이벤드 전체
    toTalRank(no) {
        //let day = "20190322-20190426";
        let eventTime = 'ALL';
        return EventTradingCollection.find({eventNo : no,  eventTime: eventTime }, { sort: { tradetotalPrice: -1 }, readPreference: ReadPref.SECONDARY });
    },

    //이벤드
    async weekRank(no) {

        let eventInfo = await EventListCollection.findOne({eventNo : no});

        let stDt = eventInfo.stDt;
        let enDt = eventInfo.enDt;

        let stDay :Date; //eventInfo.stDt
        let enDay :Date;//eventInfo.enDt
        //let eventTimeline = Number(((enDt.getTime() -  stDt.getTime()) / 604800000).toFixed(0));    
        
        let now = new Date();
        
        let tradingList = [];
        let myWeekTradeVal = 0;

  
        let eventTime = '';

        if(enDt < now){
             eventTime = '5week';
        }else if(new Date(enDt.getTime() - 604800000) < now  && enDt >= now ) {
            eventTime = '5week';
        }else if(new Date(enDt.getTime() - (604800000*2)) < now  && new Date(enDt.getTime() - (604800000*1)) >= now ) {
             eventTime = '4week';
        }else if(new Date(enDt.getTime() - (604800000*3)) < now  && new Date(enDt.getTime() - (604800000*2)) >= now ) {
             eventTime = '3week';
        }
        else if(new Date(enDt.getTime() - (604800000*4)) < now  && new Date(enDt.getTime() - (604800000*3)) >= now ) {
             eventTime = '2week';
        }
        else if(new Date(enDt.getTime() - (604800000*5)) < now  && new Date(enDt.getTime() - (604800000*4)) >= now ) {
             eventTime = '1week';
        }

        return EventTradingCollection.find({eventNo : no, eventTime: eventTime }, { sort: { tradetotalPrice: -1 }, readPreference: ReadPref.SECONDARY });
    },

    insertContactUs(form : ContactUs){
        LogUtil.info({ console: 'insertContactUs' }, true);
        return ContactUsService.insertContactUs(form);
    },
    
    getFaqList() {
        LogUtil.info({ console: 'getFaqList' }, true);
        return FaqService.getFaqList();
    },

    getCnFaqList(){
        LogUtil.info({ console: 'getCnFaqList' }, true);
        return FaqService.getCnFaqList();
    },
    
    /* (19-05-24 ~ 19-06-28) 벤타스코인 보유량 이벤트 시작 */
    createAssetEvent(eventNo: string, limit: number) {
        LogUtil.info({ console: 'createAssetEvent', eventNo }, true);

        let userId = Meteor.userId();
        if (!userId) {
            return { code: ResultCode.ERROR }
        }

        return EventService.createAssetEvent(eventNo, limit, userId);
    },

    getMyEventHistory(eventNo: string, limit: number) {
        LogUtil.info({ console: 'getMyEventHistory', eventNo }, true);

        let userId = Meteor.userId();
        if (!userId) {
            return { code: ResultCode.ERROR }
        }

        return EventService.getMyEventHistory(eventNo, limit, userId);
    },

    async getEventBalance(eventNo: string) {
        LogUtil.info({ console: 'getEventBalance', eventNo }, true);

        let userId = Meteor.userId();
        if (!userId) {
            return { eventBalance: 0, walletBalance: 0 };
        }

        let eventInfo = await EventService.getEventInfo(eventNo);
        if (!eventInfo || !eventInfo.stDt || !eventInfo.targets[0]) {
            return { eventBalance: 0, walletBalance: 0 };
        }

        return EventService.getEventBalance(eventInfo.targets[0], userId, eventInfo.stDt);
    },
    /* (19-05-24 ~ 19-06-28) 벤타스코인 보유량 이벤트 끝 */

    // 투표현황 보기
    getVoteList(num? : number){
        return VoteService.getVoteList(num);
    },
    // 투표하기
    vote(type : string, voteNo : number){
        return VoteService.vote(type,voteNo);
    },
    // 투표 여부 체크
    voteCheck(voteNo : number){
        let user = Meteor.userId();

        if(!user){
            return true;
        }

        return VoteService.voteCheck(voteNo, user);
    },
    insertOffer(offer : any){
        return VoteService.insertOffer(offer);
    },
    getIndicatorsValue(id: string, coin: string) {
        LogUtil.info({ console: 'getIndicatorsValue' }, true);
        return IndicatorsService.getIndicatorsValue(id, coin);
    },
    // 사용자의 마지막 입금내역을 찾고, 72시간 이내이면 false, 72시간 이후면 true 리턴
    getMyLastDepositTransfer(userId : string){
        return TransferService.getMyLastDepositTransfer(userId);
    },
    getForeignTicker(){
        return HomeService.getForeignTicker();
    },
    async googleotpCreate() {
        LogUtil.info({ console: 'googleotpCreate' }, true);
        let user = Meteor.user();

        if(!user){
            return;
        }
        let speakeasy = require("speakeasy");

        let secret = speakeasy.generateSecret({length: 20, name : user.emails[0].address, algorithm: 'sha512'});
        let url = speakeasy.otpauthURL({ secret: secret.ascii, issuer: 'ventasbit', label: user.emails[0].address, period : 30});
        user.profile.otp = secret
        await Users.update({ _id: user._id }, { $set: { profile: user.profile } });

        return {secretKey:secret.base32, url:url};
    },
    googleotpCheck(e : number, userkey : string) {
        LogUtil.info({ console: 'googleotpCheck', e }, true);
        let user = Meteor.user();
        let key = '';
        
        if(!user){
            key = userkey
        } else {
            key = user.profile.otp.base32 
        }
        let speakeasy = require("speakeasy");
        
        let verified = speakeasy.totp.verify({
            secret: key,
            encoding: 'base32',
            token: e
        });
        
        return verified;
    },
    updateUserCountry(value: string){
        return UserService.updateUserCountry(value);
    },
    updateUserOtpOut(){
        return UserService.updateUserOtpOut();
    },
    addressBookRemoveMany(books:any){
        LogUtil.info({ console: 'addressBookRemoveMany', books : books }, true);
        return AddressBookService.addressBookRemoveMany(books);
    },
    updateUsercert(agreeType: string, value: string){
        return UserService.updateUsercert(agreeType,value);
    },
    AlluserInfoHistory(){
        if(!Meteor.userId()){
            return
        }
        return UserInfoHistoryService.AlluserInfoHistory(Meteor.userId());
    },
    setUserInfoHistory(){
        return UserInfoHistoryService.setUserInfoHistory();
    },
});