import _ from 'lodash';

class MongoUtilService {
    public static stripMongo(obj: any): any {
        return _.cloneDeepWith(obj, (value) => {
            if (_.isObject(value) && !_.isArray(value)) {
                // Directly omit the '_id' key from the object
                return _.omit(value, ['_id', 'updatedAt', 'createdAt']);
            }
        });
    }
}

export default MongoUtilService;
