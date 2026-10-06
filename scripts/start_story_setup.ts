// Local owner configuration only. This process has no generator, payment or product routes.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {installLocalStorySetup} from '../server/localStorySetup';
process.env.LOCAL_STORY_SETUP='true';
if(process.env.NODE_ENV==='production')throw new Error('setup_not_for_production');
const port=Number(process.env.STORY_SETUP_PORT)||39790;
const app=express();app.use(express.json({limit:'16kb'}));installLocalStorySetup(app);
for(const file of ['local-story-setup.js','local-story-setup.css'])app.get('/'+file,(_req,res)=>res.sendFile(path.resolve('public',file)));
app.get('/',(_req,res)=>res.redirect('/local-story-setup'));
const server=app.listen(port,'127.0.0.1',()=>console.info(`LOCAL_SETUP_RUNNING http://127.0.0.1:${port}/local-story-setup; no model or payment I/O routes`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>server.close(()=>process.exit(0)));
