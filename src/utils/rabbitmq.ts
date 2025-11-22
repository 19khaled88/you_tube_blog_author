
import amqp from 'amqplib'

let channel:amqp.Channel;

export const connectRabbitMQ = async()=>{
    try {
        const connection = await amqp.connect(process.env.AMQP_URL!)

        channel = await connection.createChannel();

        // await channel.assertQueue('emails')

        console.log('Connected to CloudMQ supported RabbitMQ');
    } catch (error) {
        console.log('Failed to connect to RabbitMQ');
    }
}

export const publishToQueue = async(queueName:string,message:any)=>{
    if(!channel){
        console.error("Rabbitmq channel is not initialized")
        return;
    }

    await channel.assertQueue(queueName, {durable:true});

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)),{
        persistent:true, 
    });
};

export const invalidateChacheJob = async(cacheKeys:string[])=>{
    try {
        const message = {
            action:'invalidateCache',
            keys:cacheKeys,
        };

        await publishToQueue('cache-invalidate', message)

        console.log('Cache invalidateion job published to RabbitMQ')
    } catch (error) {
        console.error('Failed to connect to RabbitMQ', error)
    }
}

