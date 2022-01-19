import { ContactUs, ResultCode } from "../models";
import { ContactUsCollection } from "../collections";
import { LogUtil } from "../lib";

export class _ContactUsService {
    public async insertContactUs(contactUs: ContactUs) {
        if (!contactUs || !contactUs.company || !contactUs.phoneNo || !contactUs.title || !contactUs.type || !contactUs.email || !contactUs.contents) {
            LogUtil.error({ e: "insertContactUS(): param is undefined.", contactUs });
            return { code: ResultCode.ERROR }
        }

        let result;
        try {
            result = await ContactUsCollection.insert(contactUs).first().toPromise();

            if (!result) {
                LogUtil.error({ e: "insertContactUS(): insert is failed.", result });
                return { code: ResultCode.ERROR };
            }

        } catch (err) {
            LogUtil.error({ e: "insertContactUS(): " + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }
}
export const ContactUsService = new _ContactUsService();