import { SQSHandler, SQSMessageAttributes, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk'
import uuidv1 from 'uuid/v1'
import Jimp from 'jimp'
const https = require('https')

const Bucket: string = process.env.AWS_S3_BUCKET
const accessKeyId: string = process.env.AWS_S3_ACCESS_KEY_ID
const secretAccessKey: string = process.env.AWS_S3_SECRET_ACCESS_KEY
const endpoint: any = new AWS.Endpoint(process.env.AWS_S3_ENDPOINT)
const partSize: number = 20 * 1024 * 1024
const queueSize: number = 10

const receiver: SQSHandler = async (event: SQSEvent, context: any): Promise<any> => {
  console.log('SQSHandler Invoked - v17')

  try {
    const record = event.Records[0]
    const messageAttributes: SQSMessageAttributes = record.messageAttributes;

    // Debug
    console.log('SQSHandler messageId: ', record.messageId);
    console.log('SQSHandler Attributtes: ', messageAttributes);
    console.log('SQSHandler Body: ', record.body);

    // Setup the variables
    const uri: string = messageAttributes['uri'].stringValue;
    const mime: string = messageAttributes['mime'].stringValue;
    const channelId: string = messageAttributes['channelId'].stringValue;
    const messageId: string = messageAttributes['messageId'].stringValue;
    const attachmentId: string = messageAttributes['attachmentId'].stringValue;

    console.log(uri, mime, channelId, messageId, attachmentId)

    // Create our image
    const image: any = await Jimp.read(uri)
    const buffer : any = await image.resize(256, 256).quality(60).getBufferAsync(image.getMIME())
    const name: string = uri.split('/')[uri.split('/').length - 1]
    const Key: string = channelId + '/preview/' + uuidv1() + '-preview.' + name
    const Body: any = buffer

    // Authenticate with S3
    const s3: any = new AWS.S3({
      s3BucketEndpoint: true,
      endpoint,
      accessKeyId,
      secretAccessKey,
    })

    // Create the S3 config values (10 MB)
    const options: any = {
      partSize,
      queueSize,
      ContentType: mime,
      ACL: 'public-read',
    }

    // Set up our S3 params object to use in our request
    const params: any = {
      Bucket,
      Key,
      Body,
      ACL: 'public-read',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }

    console.log(Key, Body, s3, options, params)

    // Do the actual upload
    const s3data: any = await new Promise((resolve, reject) => {
      s3.upload(params, options, (err, data) => {
        if (err) reject(err);
        if (!data.Location) reject('No location data');

        resolve(data);
      })
    })

    console.log(s3data)

    const postdata = JSON.stringify({
      channelId,
      messageId,
      attachmentId,
      preview: 'https://yack.app/icon.svg'//data.Location
    })

    const postoptions = {
      hostname: process.env.API_PATH.replace('https://',''),
      port: 443,
      path: '/v1/upload/message_attachment_preview',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postdata.length
      }
    }

    const httpdata: any = await new Promise((resolve, reject) => {
      var request = https.request(postoptions, (res) => {
          const body = [];

          res.setEncoding('utf8');
          res.on('data', (chunk) => body.push(chunk));
          res.on('end', () => resolve(body.join('')));
      });

      request.on('error', (err) => reject(err))
      request.write(postdata);
      request.end();
    })

    console.log(httpdata, postoptions)

    context.done()

    return true
  } catch (e) {
    console.log(e)
    return false
  }
};

export default receiver;
