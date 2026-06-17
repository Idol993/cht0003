/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import packageRoutes from './routes/packages.js'
import lockerRoutes from './routes/lockers.js'
import reservationRoutes from './routes/reservations.js'
import statisticsRoutes from './routes/statistics.js'
import userRoutes from './routes/users.js'
import notificationRoutes from './routes/notifications.js'
import { startCronJobs } from './services/cronService.js'
import { getDb } from './db/index.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Initialize database
;(async () => {
  try {
    await getDb()
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }
})()

// Start scheduled tasks
startCronJobs()

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/packages', packageRoutes)
app.use('/api/lockers', lockerRoutes)
app.use('/api/reservations', reservationRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
