import { VentasActionCollection, OrderCollection, CompanyAssetCollection } from "../collections";
import { Order, ResultCode, CompanyAsset, VentasAction, FiatRate } from "../models";
import { LogUtil, ServerUtil, DecimalUtil } from "../lib";
import { OrderService } from "./order.service";
import { CompanyAssetService } from "./companyasset.service";

export class _VentasActionService {

    public async detectTrade(fiatRate: FiatRate) {

    }

    public async detectOrder(order: Order, isTrade: boolean) {
        let orderAction = await this.initOrderAction(order, isTrade);

        if (!orderAction) {
            LogUtil.error({ e: 'detectOrder(): detectOrder is undefined. ' });
            return { code: ResultCode.ERROR };
        }

        let result;
        try {

            result = await VentasActionCollection.update({ src: orderAction.src, target: orderAction.target, actionKind: 'order' }, { $set: orderAction }, { upsert: true }).first().toPromise();
            if (!result) {
                LogUtil.error({ e: "detectOrder(): update is failed.", orderAction });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: "detectOrder(): " + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };

    }

    private async initTradeAction() {


    }

    private async initOrderAction(order: Order, isTrade: boolean) {
        if (!order) {
            LogUtil.error({ e: 'initOrderAction(): param is undefined. ', order })
            return undefined;
        }

        let companyAsset = await CompanyAssetService.getCompanyAsset(order.src, order.target);
        if (!companyAsset) {
            LogUtil.error({ e: 'initOrderAction(): param is undefined. ', companyAsset })
            return undefined;
        }

        let orderAction: VentasAction = {
            closePrice: Number(companyAsset.prevClosingPrice),
            dailyTradingValue: Number(companyAsset.dailyTradingValue),
            dailyVolumn: Number(companyAsset.dailyVolumn),
            highPrice: Number(companyAsset.highPrice),
            lowPrice: Number(companyAsset.lowPrice),
            openingPrice: Number(companyAsset.openingPrice),
            highPriceWithinYear: Number(companyAsset.highPriceWithinYear),
            lowPriceWithinYear: Number(companyAsset.lowPriceWithinYear),
            highPriceUpDt : companyAsset.highPriceUpDt,
            lowPriceUpDt : companyAsset.lowPriceUpDt,
            presentPrice: Number(companyAsset.presentPrice),
            tradingPower: Number(companyAsset.tradingPower),
            src: companyAsset.src,
            target: companyAsset.code,
            name: companyAsset.name,
            actionKind: 'order',
            kind: order.kind,
            amount: DecimalUtil.sub(order.amount, order.initAmount),
            maxCoinAmount: await OrderService.getMaxAmount(companyAsset.src, companyAsset.code),
            isTrade: isTrade,
            USDTclosingPrice: Number(companyAsset.USDTclosingPrice),
            KRWclosingPrice: Number(companyAsset.KRWclosingPrice),
            minOrderPrice : Number(companyAsset.minOrderPrice),
        }        

        CompanyAssetService.setMaxCoinAmount(companyAsset._id, orderAction.maxCoinAmount);

        return orderAction;
    }

}
export const VentasActionService = new _VentasActionService();