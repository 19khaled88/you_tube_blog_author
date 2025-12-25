import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { sql } from './utils/db.js';
import blogRoutes from './routes/blog.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';
import cors from 'cors';

dotenv.config();
// connectDb();

const app = express();

// app.use(cors({
//     origin: "https://you-tube-blog-web.vercel.app",
//     methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
//     credentials: true,
//     allowedHeaders: "Content-Type, Authorization"
// }));


const corsOptions = {
  origin: [
    "https://you-tube-blog-web.vercel.app",
    "http://localhost:3005",
  ],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Optional but safe:
app.options(/.*/, cors());

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
                avatar VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // ✅ Ensure avatar exists even if table was created before
        await sql`
            ALTER TABLE blogs
            ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) DEFAULT NULL;
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS comments ( 
                id SERIAL PRIMARY KEY,
                comment VARCHAR(255) NOT NULL,
                userId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                blogId VARCHAR(255) NOT NULL,
                avatar VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // ✅ Ensure avatar exists even if table was created before
        await sql`
            ALTER TABLE comments
            ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) DEFAULT NULL;
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

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Blog author Service is running successfully',
        data: '',
        success: true
    });
});

app.use('/api/v1', blogRoutes);

startServer().then(() => {
    app.use(express.json());

    app.listen(port, () => {
        console.log(`Author Server running on port:${port}`)
    })
});

