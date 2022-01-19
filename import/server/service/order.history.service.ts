import { Order, ResultCode } from "../models";
import { LogUtil } from "../lib";
import { OrderHistoryCollection } from "../collections";




export class _OrderHistoryService {

    public async insertOrderHistory(order: Order) {
        if (!order) {
            LogUtil.error({ e: 'insertOrderHistory(): order is undefined.', order });
            return { code: ResultCode.ERROR }
        }

        let result
        try {
            result = await OrderHistoryCollection.rawCollection().insert(order);
            if (!result) {
                LogUtil.error({ e: 'insertOrderHistory(): insert is failed. ', order });
                return { code: ResultCode.ERROR }
            }
        } catch (err) {
            LogUtil.error({ e: 'insertOrderHistory(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC }
    }


}
export const OrderHistoryService = new _OrderHistoryService();