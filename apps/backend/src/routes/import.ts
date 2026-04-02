import { Router } from 'express'
import multer from 'multer'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { importCSV, parseCSV } from '../services/csv/CSVImportService'

export const importRouter = Router()
importRouter.use(requireAuth)

// In-memory storage — we parse immediately, don't store the file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5 MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Tylko pliki CSV są akceptowane'))
    }
  },
})

// POST /import/csv
// Body: multipart/form-data, field: "file" (CSV)
// Returns: { bank, imported, skipped, errors }
importRouter.post('/csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Brak pliku CSV' })
  }

  const { userId } = req as AuthRequest
  const content = req.file.buffer.toString('utf-8')

  const result = await importCSV(userId, content)

  return res.status(result.imported > 0 ? 201 : 400).json(result)
})

// POST /import/csv/preview
// Parses CSV and returns first 10 transactions WITHOUT saving to DB.
// Useful for the mobile app to show a preview before confirming import.
importRouter.post('/csv/preview', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Brak pliku CSV' })
  }

  const content = req.file.buffer.toString('utf-8')
  const { bank, transactions, skipped, errors } = parseCSV(content)

  return res.json({
    bank,
    total:        transactions.length,
    skipped,
    errors,
    preview:      transactions.slice(0, 10),
  })
})
