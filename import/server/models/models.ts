import { Meteor } from "meteor/meteor";

/**
 * 객채 권한
 */
export enum ObjRight {
    ANONY = <any>'anony',         //아무나 조회가능하다.
    USER = <any>'user',         // 로그인한 사용자만 조회가능.
    OWNER = <any>'onwer',         //소유자만 조회가능
    ADMIN = <any>'admin'         //관리자만 조회가능
}

export class Options {
    [key: string]: any;
}

export interface User extends Meteor.User {
    profile?: Profile;
    roles?: any;
}

export enum ReadPref {
    PRIMARY = 'primary',
    PRIMARY_PREFERRED = 'primaryPreferred',
    SECONDARY = 'secondary',
    SECONDARY_PREFERRED = 'secondaryPreferred'
}

export enum LockType {
    balance = <any>"balance",
    blknoti = <any>"blknoti",
    seq = <any>"seq_lock",
    order = <any>"order",
    wallet = <any>"wallet",
    companyAsset = <any>"companyAsset",
    coinAddress = <any>"coinAddress"
}

//공통 영역
export class CollectionObject {
    _id?: string;
    inDt?: Date;//생성일
    inUser?: string;//생성자
    upDt?: Date;//수정일
    upUser?: string; // 수정자
}

/**
 *  사용자 프로파일.
 * 맞춰야 한다.
 */
export class Profile {
    name?: string;
    picture?: string;
    phoneNo?: string;
    recommender?: string; // 추천인
    alias: string;//별칭
    userRate?: string;//등급명
    lockCode?: string;//잠금 비밀번호
    lockUse: boolean;//잠금 사용
    notiLogin: boolean;//로그인 알림
    notiNew: boolean;//신규장비 알림
    notiInOut: boolean;//입출금 알림
    notiTrade: boolean;//거래알림
    silentMode: boolean;// 무음모드
    recievSms: boolean;// sms 수신
    recievEmail: boolean;// 이메일 수신

    useOtp: boolean;
    otpCode: string;
    bankCode: string;
    bankName: string;
    bankOwner: string;
    secuLevel: string;// 보안등급
    accountLock: boolean;// 계정잠금
    accountLockReason: string;//
    accountLockDate: string;//
}

export enum Status {
    NONE = <any>0,
    REQ = <any>5,
    READY = <any>10,
    ING = <any>20,
    COMPLETE = <any>60,
    ERROR = <any>80,
    CANCEL = <any>90,
    ADMIN_CANCEL = <any>99,
}

export interface Sequence {
    _id: string;
    value: number;
}
//코인 내역
export class CompanyAsset extends CollectionObject {
    kind: string;                   // 은행, 코인 coin/cash
    src: string;                    // 마켓
    code: string;                   // 코인단위, 은행코드  
    name: string;                   // 코인명.
    keyword: string;                // 검색단어
    tradeYn: boolean;               // 코인 거래 가능 여부
    useYn: boolean;                 // 코인 사용 여부
    order: number;                  // 표시 순번
    openingPrice: number;           // 시가
    presentPrice: number;           // 현재가
    highPrice: number;              // 고가
    lowPrice: number;               // 저가
    dailyVolumn: number;            // 금일거래량
    dailyTradingValue: number;      // 금일거래대금
    prevPresentPrice: number;       // 직전거래현재가
    prevClosingPrice: number;       // 전일 종가  
    highPriceUpDt: Date;            // 고가 업데이트 시간
    lowPriceUpDt: Date;             // 저가 업데이트 시간
    highPriceWithinYear: number;    // 52주 최고
    lowPriceWithinYear: number;     // 52주 최저
    tradingPower: number;           // 체결 강도
    maxCoinAmount?: number;         // 주문에 올라와있는 코인 최대량
    coinCnName? : string;           // 중국이름

    // 미 사용 중인 column.
    withdrawYn?: boolean;           // 출금가능여부
    tradeFee?: number;              //거래수수료    
    withdrawFee?: number;           //출금 수수료
    withdrawMin?: number;           //최소 출금 가능액
    withdrawMax?: number;           //최대 출금 가능액  
}

// 관심 코인 리스트
export class FavoriteAsset extends CollectionObject {
    code: string;
    src: string;
    name: string;
    sno: number;
}

// 사용자 지갑
export class UserWallet extends CollectionObject {
    owner: string;
    kind: string; //종류. coin/cash  
    assetCode: string;//은행코드,코인코드
    assetName: string;//은행명,코인명
    useYn: boolean;//사용여부
    balance: number;//잔고.
    available: number;//사용가능액.
    eval: number;//평가금액,구매시 비율...,
    USDTeval: number;//평가금액,구매시 비율...,
    address: string;//계좌번호
    status: Status;
    strBalance?: string; // 정밀 연산용 컬럼
    strAvailable?: string // 정밀 연산용 컬럼
}

// 체결 정보
export class FiatRate extends CollectionObject {
    src: string;              // 기준코인
    target: string;           // 대상통화. KRW,USD, 
    kind: string;             // 매도,매수
    prevClosingPrice: number; // 전일종가.  
    highPrice: number;        // 고가
    lowPrice: number;         // 저가
    openingPrice: number;     // 시가  
    presentPrice: number;     // 현재가    
    closePrice: number;       // 종가
    amount: number;           // 수량
    ts: number;               // 기준시각   
    highPriceUpDt: Date;      // 고가 갱신 시간
    lowPriceUpDt: Date;       // 저가 갱신 시간
}

// 일별 체결 정보
export class DailyFiatRate extends CollectionObject {
    src: string;                  // 기준코인
    target: string;               // 대상통화. KRW,USD  
    highPrice: number;            // 고가
    lowPrice: number;             // 저가  
    presentPrice: number;         // 현재가
    prevClosingPrice: number;     // 전일 종가
    openingPrice: number;         // 시가 
    dailySellAmount: number;      // 일별 매수 거래 량 (maker 기준)
    dailyBuyAmount: number;       // 일별 매도 거래 량 (maker 기준)
    dailyTradingValue: number;    // 일별 거래 대금
    highPriceUpDt: Date;          // 고가 갱신 시간.
    lowPriceUpDt: Date;           // 저가 갱신 시간.
}

// 결과 코드
export class ResultCode {
    static readonly SUC: number = 200;
    static readonly EXIST: number = 300;
    static readonly EXIST_ERR: number = 400;
    static readonly NOTFOUND: number = 404;
    static readonly ERROR: number = 500;
    static readonly ERROR_INVALID_PARAM: number = 501;

    static readonly ERROR_PERM: number = 503;
    static readonly ERROR_EQ_PREV_PWD: number = 504;
}

// 주문 테이블
export class Order extends CollectionObject {
    type: string;
    owner: string;
    kind: string;
    src: string;
    target: string;
    ownerFee: number;
    makerFee: number;
    price: number;
    initAmount: number;
    amount: number
    status: number;
    oId: string;
    country?  : string;
}

export class Trade extends CollectionObject {
    orderOwner: string;
    orderOwnerCountry? : string;
    owner: string;
    ownerCountry? : string;
    kind: string;
    type: string;
    src: string;
    target: string;
    ownerFee: number;
    takerFee: number;
    orderOwnerFee: number;
    price: number;
    amount: number;
    status: number;
    tId: string;
    oId: string;
    marketKRWPrice?: number;
}

export class WalletLedger extends CollectionObject {
    owner: string;
    assetCode: string;
    balance: number;
    available: number;
}

export class UserWalletHistory extends CollectionObject {
    walletId: string;
    walletCode: string;
    prevAvailable: any;
    prevBalance: any;
    available: any;
    balance: any;
    laterAvailable: any;
    laterBalance: any;
    type: UserWalletHistoryType;
}
export enum UserWalletHistoryType {
    trade = "trade",
    order = "order",
    transfer = "transfer",
    event = "event",
    ieo = "ieo"
}

// 변화감지를 위한 테이블
export class VentasAction extends CollectionObject {
    src: string;    // 마켓
    target: string; // 코인    
    presentPrice: number;   // 현재가
    closePrice: number; // 전일 종가
    kind: string;   // buy, sell
    highPrice: number;  // 고가
    lowPrice: number;   // 저가
    highPriceWithinYear: number;    // 52주 최고가
    lowPriceWithinYear: number;     // 52주 최저가
    highPriceUpDt : Date ; //52추 최고가 일시
    lowPriceUpDt : Date;   // 52주 최저가 일시
    tradingPower: number;   // 체결 강도
    amount: number;     // 수량
    dailyTradingValue: number;  // 24시간 거래 대금
    dailyVolumn: number;    // 24시간 거래 수량
    actionKind: string; // 감지 종류
    name: string; // 이름
    maxCoinAmount: number;
    isTrade: boolean;
    openingPrice: number;
    USDTclosingPrice? : number; // USDT마켓 전일종가
    KRWclosingPrice? : number; // KRW마켓 전일종가
    minOrderPrice? : number; // minOrderPrice 최소주문가능금액
}

// IEO 거래 관련 테이블
export class IEOHistory extends CollectionObject {
    owner: string;
    assetCode: string;
    price: number;
    amount: number;
    status: Status;
}

// IEO 리스트
export class IEOList extends CollectionObject {
    ieoNo: number;
    basicInformation: {
        kName: string;                               // 명칭 (한글)
        eName: string;                               // 명칭 (영문)
        code: string;                                // 코드명
        techBase: string;                            // 기술기반
        usageField: string;                          // 이용분야 (40자)
        introduction: string;                        // 간략소개 (40자)
        title: string;                               // 제목
    };
    tradeInformation: {
        initPrice: number;                           // 시작가
        initAmount: number;                          // 최소구매수량
        airDrop: number;                             // 에어드랍
        incinerationYN: boolean;                     // 미판매량 소각여부
        totalAmount: number;                         // 코인 총량
        startDate: Date;                             // 시작일
        endDate: Date;                               // 종료일
    };
    homepage: string;                              // 홈페이지 링크
    cousionList: Array<string>;                    // 유의사항
    imgFile: string;                               // 이미지 파일명
    detailImgFile: string;                         // 상세페이지 큰 이미지 파일명
    status: number;                                // 상태값 (논의필요)
    adminUser: string;                             // 결제자 이름
    tradeCondition: {
        buyerCount: number;                          // 구매자 수
        sellingPrice: number;                        // 총 판매 금액
        totalTradingAmount: number;                  // 총 판매 수량
    }
}

export class Transfer extends CollectionObject {
    kind: string;                    // 출금, 입금
    owner?: string;                  // 이체 신청자
    ownerName?: string;              // 이체 신청자 이름
    ownerEmail?: string;             // 이체 신청자 메일
    fromAddress: string;             // 송금 주소
    toAddress: string;               // 수금 주소
    addressType: string;             // 내부, 외부
    assetCode: string;               // 코인 종류
    status: TransferStatus;          // 처리 결과
    amount: number;                  // 이체 금액
    ownerFee: number;                // 이체 신청자 수수료
    fee: number;                     // 수수료 금액 
    totalAmount: number;             // 최종 금액 
    bankNo?: string;                 // 은행 계좌 번호
    bankCode?: BankCode;             // 은행 코드
    bankName?: string;               // 은행 이름 
    confirmPrice?: number;           // 확인 금액
    confirmUser?: string;            // 확인자
    confirmDt?: Date;                // 확인 날짜 
    approvalUser?: string;           // 승인자 
    approvalDt?: Date;               // 승인 날짜 
    tId: string;                     // 접수 번호
    txId?: string;                    // txId
    networkFee?: number;             // 네트워크 수수료
    destTag?: string;               // for XRP
    country?: string;               // 국가코드
}
export enum BankCode {
    // KDB = '002',    // 산업은행
    '003' = '기업은행',    // 기업은행
    '004' = '국민은행',     // 국민은행
    // KEB = '005',    // 외환은행
    // SUHYUP = '007', // 수협중앙회
    '011' = '농협은행',     // 농협은행
    '020' = '우리은행',  // 우리은행
    '023' = 'SC은행',     // SC은행
    '027' = '씨티은행',   // 한국씨티은행
    // DGB = '031',    // 대구은행
    // BUSAN = '032',  // 부산은행
    // KJ = '034',     // 광주은행
    // JEJU = '035',   // 제주은행
    // JB = '037',     // 전북은행
    // KN = '039',     // 경남은행
    '045' = '새마을금고',   // 새마을금고중앙회
    '048' = '신협중앙회',     // 신협중앙회
    // BOA = '060',    // BOA은행
    '071' = '우체국',  // 우체국
    '081' = '하나은행',  // 하나은행
    '088' = '신한은행',// 신한은행
    '090' = '카카오뱅크',// 카카오뱅크
    // MYASSET = '209',// 동양증권
    // MIRAEASSET = '230',// 미래에셋증권
    // SAMSUNGPOP = '240',// 삼성증권
    // NHQV = '247',   // 우리투자증권
    // DAISHIN = '267',// 대신증권
    // HANHWA = '269' // 한화 투자 증권 
}
export enum BankIdentificationCode {
    '003' = 'TXEB9KSV',
    '004' = '004',
    // '005' = 'REALTIME',
    '011' = 'SRS1',
    '027' = 'JCKC',
    // '037' = 'DONKSVN'
}
export enum TransferStatus {
    UNCONFIRMED = 101, // 접수
    DISAPPROVAL = 102, // 미승인
    RETURN = 103,   //반려
    COMPLETE = 104,  //완료
    NOTPAID = 105  // 0 때림
}
export class TransferReqMsg {
    bank_code: string;
    seq_code: string;
    send_date: string;
    send_time: string;
    address: string;
    msg: string
}
export class CoinAddress extends CollectionObject {
    assetCode: string;
    address: string;
    useYn: boolean;
    walletId: string;
}
export class AddressBook extends CollectionObject {
    owner: string;
    addressName: string;
    assetCode: string;
    address: string;
    destinationTag? : string;
}
/**
 * 인증
 */
export class Cert extends CollectionObject {
    userId: string;// 사용자
    certYn: boolean;// 인증여부
    certNo: string;// 인증번호
    certType: string;// 인증방법 email,sms,account ,nice
    target: string;//인증대상,  mail 주소, 전화번호, 계정
    status?: string;
    response?: Object;
    enc?: string;
    testUserId?: string;// 테스트사용자Id
    bankName?: string;
    bankCode?: BankCode;
    address?: string;
}

// 접속정보
export class History extends CollectionObject {
    category: string;
    message?: string;
    data?: any;
}

// 문의
export class Question extends CollectionObject {
    userId : string;
    category : string;
    title : string;
    status : number;
    textarea : any;
    personalInfoAgree : boolean;
    file? : any;
    fileText? : string
    reply? : string;
}

// 공지
export class Notice extends CollectionObject {
    no: number;
    group: string;
    title: string;
    contents: string;
    useYn: string;
}

export class EventList extends CollectionObject {
    eventNo: string;
    useYn: string;
    title: string;
    inUser: string;
    stDt: Date;
    enDt: Date;
}
export class EventTrading extends CollectionObject {
    day?: string;
    user?: string;
    name?: string;
    email?: string;
    tradetotalPrice?: number;
    tradeFee?: number;
}

export class ContactUs extends CollectionObject{
    type: string;
    phoneNo: string;
    email: string;
    company: string;
    title: string;
    contents: string;
    file: string;
}

export class Faq extends CollectionObject {
    no: number;
    title: string;
    group: string;
    content: string;
}

export class VoteList extends CollectionObject {
    name?: string;           // 코인명
    code?: string;           // 코드
    memo?: string;           // 간단설명
    detail?: string;         // 상세설명
    stDt?: Date;              // 투표시작일
    enDt?: Date;              // 투표마감일
    disPlayYn?: string;       // 보이기유무
    thumbnailImg?: string;    // 썸네일이미지 경로
    agree?: number;           // 찬성자 수
    opposition?: number;      // 반대자 수
    crape?: boolean;          // 상장여부
    crapeDt?: Date;           // 상장일시
    realCrape? : boolean;     // 상장확정
    profile?: {
        url?: string;          // 개발사 페이지 경로
        whitebook?: string;    // 백서 경로
        start?: Date;          // 발행일
        totalPublish?: number; // 총 발행량
        circulation?: number;  // 유통량
        protocol?: string;     // 기반기술
        maker?: string;        // 개발자
    };
    voteNo?: number;          // 코인번호
}

export class Vote extends CollectionObject {
    voter? : string;
    voteNo? : number;
    voting? : string;
}

export class VoteOffer extends CollectionObject {
    name? : string;
    code? : string;
    url? : string;
    detail? : string;
}

//보조지표
export class Indicators extends CollectionObject {
    userId: string;
    email: string;
    KRW: number;
    ADA: number;
    BCH: number;
    BLOOD: number;
    BTC: number;
    CRO: number;
    ETH: number;
    LTC: number;
    QTUM: number;
    STI: number;
    VENC: number;
    XMR: number;
    XRP: number;
    TOKA: number;
    PIB: number;
    totalBalance?: Object;
}

// 해외거래소 시세
export class Api extends CollectionObject {
    BTC?: any;
    ETH?: any;
    XRP?: any;
    ADA?: any;
    BCH?: any;
    ETC?: any;
    LTC?: any;
    XMR?: any;
    QTUM?: any;
    exchangeRate?: any;
}

// fcm key
export class FCM extends CollectionObject {
    key? : any;
    owner? : string;
    badge? : number;
}

// https://firebase.google.com/docs/cloud-messaging/http-server-ref   붙일 수 있는 옵션이 다양함.
// fcm message model
export class FMCMessage {
    notification?: { // 알림내용
        title?: string,
        body?: string
    }
    token?: string // 보낼사람의 토큰값
    data? : {
        title? : string,
        body? : string
    } // foreground 일때는 data 안에서받게된다.
}