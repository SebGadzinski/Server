import { Db, MongoClient } from 'mongodb';

class MongoDBService {
    public db: Db;
    private client: MongoClient;

    constructor(private dbUrl: string, private dbName: string) {
        this.client = new MongoClient(this.dbUrl);
    }

    public async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(this.dbName);
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
            throw error;
        }
    }

    public async disconnect() {
        try {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }
}

export default MongoDBService;
