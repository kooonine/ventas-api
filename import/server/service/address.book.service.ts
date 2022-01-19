import { LogUtil } from "../lib";
import { AddressBook, ResultCode, ReadPref } from "../models";
import { AddressBookCollection } from "../collections";


export class _AddressBookService {
    async insertAddressBook(assetCode: string, address: string, addressName: string, destinationTag? : string) {
        if (!assetCode || !address || !addressName || !Meteor.userId()) {
            LogUtil.error({ e: 'insertAddressBook(): param is invalid. assetCode / address / addressName : ' + assetCode + ' / ' + address + ' / ' + addressName });
            return { code: ResultCode.ERROR };
        }

        let addressBook: AddressBook = {
            owner: Meteor.userId(),
            address: address,
            assetCode: assetCode,
            addressName: addressName,
            upDt: new Date(),
        }

        if(destinationTag){
            addressBook.destinationTag = destinationTag;
        }

        try {
            await AddressBookCollection.insert(addressBook).first().toPromise();
        } catch (err) {
            LogUtil.error({ e: 'insertAddressBook(): ' + err.message });
            return { code: ResultCode.ERROR }
        }

        return { code: ResultCode.SUC };
    }

    async getAddressBookList(assetCode: string) {
        if (!assetCode || !Meteor.userId()) {
            LogUtil.error({ e: 'getAddressBookList(): param is invalid.' });
            return [];
        }

        let addressBookList = [];
        try {
            addressBookList = await AddressBookCollection.find({ owner: Meteor.userId(), assetCode: assetCode }, { sort: { upDt: -1 }, readPreference: ReadPref.SECONDARY_PREFERRED });
        } catch (err) {
            LogUtil.error({ e: 'getAddressBookList(): ' + err.message });
            return [];
        }

        return addressBookList;
    }

    async getAddressBookListByUser(userId: string) {
        if (!userId) {
            LogUtil.error({ e: 'getAddressBookListByUser(): param is invalid.' });
            return [];
        }

        let addressBookList = [];

        try {
            addressBookList = await AddressBookCollection.find({ owner: userId }, { sort: { upDt: -1 }, readPreference: ReadPref.SECONDARY_PREFERRED });

        } catch (err) {
            LogUtil.error({ e: 'getAddressBookListByUser(): ' + err.message });
            return [];
        }

        return addressBookList;
    }

    async removeAddressBook(id: string) {
        if (!id) {
            LogUtil.error({ e: 'removeAddressBook(): param is invalid.' });
            return { code: ResultCode.ERROR };
        }
        
        try {
            await AddressBookCollection.remove({ _id: id });
        } catch (err) {
            LogUtil.error({ e: 'removeAddressBook(): exception. error : ' + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code : ResultCode.SUC };
    }

    async addressBookRemoveMany(books:any){
        if(!books || books.length <= 0){
            LogUtil.error({ e: 'addressBookRemoveMany(): param is invalid.' });
            return {code : ResultCode.ERROR};
        }

        try {
            if(books.length == 1){
                await AddressBookCollection.remove({_id : books[0]._id});
            } else {
                let targets = [];
                for (let i = 0; i < books.length; i++) {
                    targets.push(books[i]._id);
                }
                
                // let result = await AddressBookCollection.find({_id:{$in:targets}});
                let result = await AddressBookCollection.rawCollection().deleteMany({ _id : {$in :targets}});
            }
            
        } catch (err) {
            LogUtil.error({ e: 'addressBookBulkRemove(): exception. error : ' + err.message });
            return { code : ResultCode.ERROR };
        }

        return { code : ResultCode.SUC };
    }
    async modifyAddressBook(modifyAddress: any) {
        if (!modifyAddress || !modifyAddress._id || !modifyAddress.addressName || !modifyAddress.address) {
            LogUtil.error({ e: "modifyAddressBook(): param is undefeined.", modifyAddress });
            return { code: ResultCode.ERROR };
        }

        let result;

        try {
            result = await AddressBookCollection.update({ _id: modifyAddress._id }, { $set: { addressName: modifyAddress.addressName, address: modifyAddress.address, destinationTag: modifyAddress.destinationTag } }).first().toPromise();

            if (!result) {
                LogUtil.error({ e: 'modifyAddressBook(): update failed.. no result' });
                return { code: ResultCode.ERROR };
            }
        } catch (err) {
            LogUtil.error({ e: 'modifyAddressBook(): update failed. ' + err.message });
            return { code: ResultCode.ERROR };
        }

        return { code: ResultCode.SUC };
    }
}
export const AddressBookService = new _AddressBookService();