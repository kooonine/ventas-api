import { Question, ResultCode, ReadPref } from "../models";
import { LogUtil } from "../lib";
import { QuestionCollection } from "../collections";

export class _QuestionService {

    async insertQuestion(question : Question) {
        if (!question.userId || !question.category || !question.title || !question.textarea || !question.personalInfoAgree) {
            LogUtil.error({ e: 'insertQuestion(): param is undefined.', question });
            return { code: ResultCode.ERROR };
        }
        
        let result;
        
        question.status = 1;

        try {
            result = await QuestionCollection.insert(question).first().toPromise();
            if (!result) {
                LogUtil.error({ e: 'insertQuestion(): insert is failed.', question });
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: 'insertQuestion(): ' + err.message });
            return { code: ResultCode.ERROR };
        }
        return { code: ResultCode.SUC };
    }

    async getQuestionList() {
        let userId = Meteor.userId();

        if (!userId) {
            LogUtil.error({ e: 'getQuestionList(): userId is undefined.' });
            return [];
        }

        let result = [];

        try {
            result = await QuestionCollection.find({ inUser: userId }, { sort : { inDt:-1 } , readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: 'getQuestionList(): ' + err.message });
            return [];
        }
        return result;
    }    
}
export const QuestionService = new _QuestionService();