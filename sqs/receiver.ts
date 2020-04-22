import { SQSHandler, SQSMessageAttributes } from 'aws-lambda';

const receiver: SQSHandler = async (event) => {
  try {
    for (const record of event.Records) {
      const messageAttributes: SQSMessageAttributes = record.messageAttributes;

      console.log('Attributtes: ', messageAttributes);
      console.log('Body: ', record.body);
    }
  } catch (error) {
    console.log(error);
  }
};

export default receiver;
