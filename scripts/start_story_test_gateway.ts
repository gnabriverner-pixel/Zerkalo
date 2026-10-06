import 'dotenv/config';
import {createStoryTestGateway} from '../server/storyTestGateway';
const app=createStoryTestGateway(process.env.STORY_TEST_UPSTREAM||'http://127.0.0.1:39791',process.env);
app.listen(39792,'127.0.0.1',()=>console.info('TEST_PAYMENT_GATEWAY http://127.0.0.1:39792; no AI/setup/operator routes'));
