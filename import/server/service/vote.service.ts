import { VoteListCollection, VoteCollection } from "../collections";
import { LogUtil } from "../lib";
import { ReadPref, ResultCode, Vote } from "../models";
import { VoteOfferCollection } from "../collections/vote.offer.collection";

export class _VoteService {
    async getVoteList(num? : number){
        LogUtil.info({ console : 'getVoteList() '}, true);
        
        try {
            if(!num){
                return await VoteListCollection.find({}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            } else {
                return await VoteListCollection.find({voteNo : num}, { readPreference: ReadPref.SECONDARY_PREFERRED });
            }
        } catch (err) {
            LogUtil.error({ e : "getVoteList(). exception. " + err.message });
            return [];
        }
    }

    // 사용자가 투표를 이미 했는지 안했는지 체크
    async voteCheck(voteNo : number, user : string){
        try {
            let arr = await VoteCollection.find({ voter : user , voteNo : voteNo } , { readPreference : ReadPref.SECONDARY_PREFERRED });
            
            if(!arr || arr.length == 0){
                return false;
            } else {
                return true;
            }
        } catch (err) {
            LogUtil.error({ e : "voteCheck(). exception. " + err.message });
            return true;
        }
    }

    // 찬성,반대 투표
    async vote(type : string, voteNo : number){
        let user = await Meteor.user();
        
        let alreadyVote = true;

        LogUtil.info({ console : 'vote() ' + type + ' / ' + voteNo } , true);

        // 사용자 유효성 검사
        if(!user._id){
            LogUtil.error({ e : 'vote(). not found user.'});
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }
        
        // 파라미터검사
        if(!type || !voteNo){
            LogUtil.error({ e : 'vote(). invalidParam.'});
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }

        // 투표진행여부 검사
        alreadyVote = await this.voteCheck(voteNo, user._id);

        if(alreadyVote){
            return { code : ResultCode.EXIST }; // 300
        }

        LogUtil.info({ console : 'vote() insert.' + type + ' / ' + voteNo } , true);

        // 투표실행
        try {
            let obj = {
                voter : user._id,
                voteNo : voteNo,
                voting : type,
                voterEmail : user.emails[0].address,
                voterName : user.profile.username ? user.profile.username : ''
            }

            await VoteCollection.insert(obj);
            
            if(type=='agree'){
                await VoteListCollection.update({ voteNo : voteNo }, { $inc : { agree : +1 }});
            } else {
                await VoteListCollection.update({ voteNo : voteNo }, { $inc : { opposition : +1 }});
            }
        } catch (err) {
            LogUtil.error({ e : "vote(). exception. " + err.message });
            return { code : ResultCode.ERROR };
        }

        return { code : ResultCode.SUC };
    }

    async insertOffer(offer : any){
        let user = await Meteor.user();

        if(!user._id){
            LogUtil.error({ e : "insertOffer(). not fount User."} , true);
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }

        if(!offer || !offer.name || !offer.code || !offer.url){
            LogUtil.error({ e : "insertOffer(). invalid param. offer : " + offer }, true);
            return { code : ResultCode.ERROR_INVALID_PARAM };
        }

        try {
            offer.userEmail = user.emails[0].address;
            offer.userName = user.profile.username ? user.profile.username : '';

            let result = await VoteOfferCollection.insert(offer);
            if(!result){
                LogUtil.error({ e : "insertOffer(). insert Failed. " } , true);
                return { code : ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e : "insertOffer(). exception. " + err.message } , true);
            return { code : ResultCode.ERROR };
        }

        return { code : ResultCode.SUC };
    }
}

export const VoteService = new _VoteService();