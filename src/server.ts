import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { sql } from './utils/db.js';
import blogRoutes from './routes/blog.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';

dotenv.config();
// connectDb();

const app = express();
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({ extended: true, limit:'10mb' }));

connectRabbitMQ();

const port = process.env.PORT;

async function startServer() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS blogs ( 
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description VARCHAR(255) NOT NULL,
                blogcontent TEXT NOT NULL,
                image VARCHAR(255) NOT NULL,
                category VARCHAR(255) NOT NULL,
                author VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS comments ( 
                id SERIAL PRIMARY KEY,
                comment VARCHAR(255) NOT NULL,
                userId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                blogId VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS savedblogs ( 
                id SERIAL PRIMARY KEY,
                userId VARCHAR(255) NOT NULL,
                blogId VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        console.log('Database initialized, and tables created successfully');
    } catch (error) {
        console.log('Error initializing database:', error);
    }
}

app.get('/', (req:Request, res:Response) => {
    res.status(200).json({
        message: 'Blog author Service is running successfully',  
        data:'',
        success:true
    });
});

app.use('/api/v1', blogRoutes);

startServer().then(() => {
    app.use(express.json());

    app.listen(port, ()=>{
    console.log(`Server running on http://localhost:${port}`)
})
});

