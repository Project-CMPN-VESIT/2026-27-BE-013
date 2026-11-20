import axios from 'axios'
import { getJWTToken } from './auth'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 300000,
})

// Attach Bearer Token to outgoing API requests automatically
API.interceptors.request.use(async (config) => {
  const token = await getJWTToken()
  if (token) {
    config.headers.Authorization = "Bearer " + token
  }
  return config
})

export const getTopics               = ()              => API.get('/topics')
export const getCached               = (key, s, e)     => API.get('/cached/' + encodeURIComponent(key) + '?start_year=' + s + '&end_year=' + e)
export const analyse                 = (key, s, e)     => API.post('/analyse', { topic_key: key, start_year: s, end_year: e })
export const chat                    = (messages, ctx) => API.post('/chat', { messages, context: ctx })
export const getNews                 = (query)         => API.post('/news', { query, page_size: 8 })
export const summariseURL            = (url)           => API.post('/summarise', { url })
export const generateSummary         = (payload)       => API.post('/generate-summary', payload)

// Phase 1 Auth & Investigation REST Endpoints
export const getMyProfile            = ()              => API.get('/api/auth/me')
export const getInvestigations       = ()              => API.get('/api/investigations')
export const createInvestigation     = (payload)       => API.post('/api/investigations', payload)
export const getInvestigationDetails = (id)            => API.get('/api/investigations/' + id)
export const updateInvestigation     = (id, payload)   => API.put('/api/investigations/' + id, payload)
export const deleteInvestigation     = (id)            => API.delete('/api/investigations/' + id)
export const getInvestigationJobs    = (id)            => API.get('/api/investigations/' + id + '/status')

// Deterministic Data Endpoints
export const getInvestigationShift       = (id)        => API.get('/api/investigations/' + id + '/shift')
export const getInvestigationSentiment   = (id)        => API.get('/api/investigations/' + id + '/sentiment')
export const getInvestigationNarratives  = (id)        => API.get('/api/investigations/' + id + '/narratives')
export const getInvestigationClaims      = (id)        => API.get('/api/investigations/' + id + '/claims')
export const getInvestigationEvidence    = (id)        => API.get('/api/investigations/' + id + '/evidence')
export const getInvestigationDocuments   = (id)        => API.get('/api/investigations/' + id + '/documents')
export const getInvestigationDivergence  = (id)        => API.get('/api/investigations/' + id + '/divergence')
export const getInvestigationPerspectives= (id)        => API.get('/api/investigations/' + id + '/perspectives')
export const getInvestigationWhyShift    = (id)        => API.get('/api/investigations/' + id + '/why-shift')
export const getInvestigationCoverage    = (id)        => API.get('/api/investigations/' + id + '/coverage')

// Phase 4 AI Endpoints
export const getAiSummary            = (id)            => API.post('/api/investigations/' + id + '/ai/summary')
export const getAiWhyShift           = (id)            => API.post('/api/investigations/' + id + '/ai/why-shift')
export const getAiNarrativeEvolution = (id)            => API.post('/api/investigations/' + id + '/ai/narrative-evolution')
export const askAi                   = (id, question)  => API.post('/api/investigations/' + id + '/ai/ask', { question })

// User Opinion / Annotation Endpoints (Phase 4)
export const getInvestigationOpinions    = (id)              => API.get('/api/investigations/' + id + '/opinions')
export const createInvestigationOpinion  = (id, payload)     => API.post('/api/investigations/' + id + '/opinions', payload)
export const updateOpinion               = (opinionId, req)  => API.put('/api/opinions/' + opinionId, req)
export const deleteOpinion               = (opinionId)       => API.delete('/api/opinions/' + opinionId)

// Research Articles Workspace (Phases 5 & 6)
export const getArticles             = ()              => API.get('/api/articles')
export const getArticle              = (articleId)     => API.get('/api/articles/' + articleId)
export const createArticle           = (payload)       => API.post('/api/articles', payload)
export const updateArticle           = (articleId, req)=> API.put('/api/articles/' + articleId, req)
export const deleteArticle           = (articleId)     => API.delete('/api/articles/' + articleId)
export const getPublicArticles       = ()              => API.get('/api/public/articles')
export const getPublicArticle        = (articleId)     => API.get('/api/public/articles/' + articleId)

export default API
