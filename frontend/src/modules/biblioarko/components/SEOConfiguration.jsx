import { useState, useEffect } from 'react'
import Button from './Button'

export default function SEOConfiguration({ seoData, onChange, postTitle, postContent, doctorName }) {
    const [score, setScore] = useState(0)
    const [validations, setValidations] = useState([])

    // Initialize fields if undefined
    const data = {
        meta_title: seoData?.meta_title || '',
        meta_description: seoData?.meta_description || '',
        focus_keyword: seoData?.focus_keyword || '',
        canonical_url: seoData?.canonical_url || '',
        schema_type: seoData?.schema_type || 'Article',
        robots_index: seoData?.robots_index !== false, // default true
        robots_follow: seoData?.robots_follow !== false, // default true
        social_title: seoData?.social_title || '',
        social_description: seoData?.social_description || '',
        social_image: seoData?.social_image || ''
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        const newValue = type === 'checkbox' ? checked : value
        onChange({ ...data, [name]: newValue })
    }

    // Real-time validation
    useEffect(() => {
        validateSEO()
    }, [data.meta_title, data.meta_description, data.focus_keyword, postContent])

    const validateSEO = () => {
        let newScore = 0
        let checks = []

        // Helper for normalization
        const normalize = (text) => {
            return text ? text.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .trim() : ""
        }

        // Title Length (Optimal: 30-65)
        const titleLen = data.meta_title.length
        if (titleLen === 0) {
            checks.push({ status: 'error', msg: 'Falta el título SEO' })
        } else if (titleLen >= 30 && titleLen <= 65) {
            newScore += 25
            checks.push({ status: 'success', msg: 'Longitud de título óptima' })
        } else if (titleLen < 30) {
            checks.push({ status: 'warning', msg: 'Título demasiado corto' })
            newScore += 10
        } else if (titleLen > 65) {
            checks.push({ status: 'warning', msg: 'Título demasiado largo (>65)' })
            newScore += 15
        } else {
            newScore += 20
            checks.push({ status: 'success', msg: 'Longitud aceptable' })
        }

        // Description Length (Optimal: 120-165)
        const descLen = data.meta_description.length
        if (descLen === 0) {
            checks.push({ status: 'error', msg: 'Falta meta descripción' })
        } else if (descLen >= 120 && descLen <= 165) {
            newScore += 25
            checks.push({ status: 'success', msg: 'Longitud descripción óptima' })
        } else if (descLen < 120) {
            checks.push({ status: 'warning', msg: 'Descripción corta (<120)' })
            newScore += 10
        } else if (descLen > 165) {
            checks.push({ status: 'warning', msg: 'Descripción muy larga (>165)' })
            newScore += 15
        } else {
            newScore += 15
            checks.push({ status: 'success', msg: 'Longitud aceptable' })
        }

        // Keyword Analysis
        if (data.focus_keyword) {
            const keyword = normalize(data.focus_keyword)
            const title = normalize(data.meta_title)
            const desc = normalize(data.meta_description)
            const isPhrase = keyword.split(/\s+/).length > 1

            if (isPhrase) newScore += 10

            if (title.includes(keyword)) {
                newScore += 20
                checks.push({ status: 'success', msg: 'Palabra clave en Título' })
            } else {
                checks.push({ status: 'warning', msg: 'Palabra clave no encontrada en Título' })
            }

            if (desc.includes(keyword)) {
                newScore += 20
                checks.push({ status: 'success', msg: 'Palabra clave en Descripción' })
            } else {
                checks.push({ status: 'warning', msg: 'Palabra clave no encontrada en Descripción' })
            }
        } else {
            checks.push({ status: 'error', msg: 'Define una palabra clave principal' })
        }

        setScore(Math.min(100, newScore))
        setValidations(checks)
    }

    const robustGenerateSEO = () => {
        if (!postTitle || !postContent) return

        // 1. Prepare Content
        const parser = new DOMParser()
        const doc = parser.parseFromString(postContent, 'text/html')
        const rawText = doc.body.textContent || ""

        // Use clean text for title analysis
        const titleDoc = parser.parseFromString(postTitle, 'text/html')
        const rawTitle = titleDoc.body.textContent || postTitle
        const cleanTitle = rawTitle.toLowerCase().replace(/[^\w\sáéíóúñ]/g, ' ')

        const cleanContent = rawText.toLowerCase()
        const words = cleanTitle.split(/\s+/).filter(w => w.length > 2)

        const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'or', 'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'desde', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde', 'quien', 'quién', 'como', 'cómo', 'mas', 'más', 'pero', 'aunque', 'sino', 'sus', 'sus', 'mi', 'mis', 'tu', 'tus']

        // 2. Extract NGrams
        let candidates = []
        words.forEach((w, index) => {
            if (!stopWords.includes(w)) candidates.push({ phrase: w, position: index })
        })

        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`
            if (!stopWords.includes(words[i]) && !stopWords.includes(words[i + 1])) {
                candidates.push({ phrase: bigram, position: i })
            }
        }

        for (let i = 0; i < words.length - 2; i++) {
            const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
            if (!stopWords.includes(words[i]) && !stopWords.includes(words[i + 2])) {
                candidates.push({ phrase: trigram, position: i })
            }
        }

        // 3. Score Candidates
        let bestKeyword = ''
        let maxScore = -1

        candidates.forEach(item => {
            try {
                const phrase = item.phrase
                const regex = new RegExp(`\\b${phrase}\\b`, 'gi')
                const matches = cleanContent.match(regex) || []
                const count = matches.length
                const phraseLen = phrase.split(' ').length

                // Aggressive weighting for phrases
                let score = count * (phraseLen * phraseLen)

                // Position Bonus
                const positionBonus = Math.max(0, 5 - item.position)
                score += positionBonus

                if (count > 0 && score > maxScore) {
                    maxScore = score
                    bestKeyword = phrase
                }
            } catch (e) { /* ignore */ }
        })

        if (!bestKeyword && candidates.length > 0) {
            bestKeyword = candidates.find(c => c.phrase.split(' ').length === 2)?.phrase || candidates[0].phrase
        }

        // 4. Generate Meta Title with Keyword Preservation
        const maxTitleLen = 60
        let brandSuffix = doctorName ? ` | ${doctorName}` : ''

        // Strategy 1: Standard Truncation
        let targetTitle = rawTitle // Start with clear title

        // Helper to check length
        const getFullTitle = (t, s) => `${t}${s}`

        // If too long, try shortening brand first
        if (getFullTitle(targetTitle, brandSuffix).length > maxTitleLen) {
            // Try simpler suffix: " | Dra. Herrera" instead of " | Dra. Mariel Herrera"
            const nameParts = doctorName?.split(' ') || []
            if (nameParts.length > 2) {
                const shortName = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
                brandSuffix = ` | ${shortName}`
            }
        }

        // Check if truncation kills the keyword
        const normKeyword = bestKeyword ? bestKeyword.toLowerCase() : ''
        const availableLen = maxTitleLen - brandSuffix.length

        // If title fits, great. If not, we truncate.
        let truncatedTitle = targetTitle
        if (targetTitle.length > availableLen) {
            let trunk = targetTitle.substring(0, availableLen)
            const lastSpace = trunk.lastIndexOf(' ')
            if (lastSpace > 0) trunk = trunk.substring(0, lastSpace)
            truncatedTitle = trunk
        }

        // If keyword exists but is lost in truncation, or was never in the truncated part
        const truncatedLower = truncatedTitle.toLowerCase()
        if (bestKeyword && !truncatedLower.includes(normKeyword)) {
            // Strategy 2: Prepend Keyword
            // "Keyword: Post Title..."
            const prefix = `${bestKeyword.charAt(0).toUpperCase() + bestKeyword.slice(1)}: `
            const newAvailable = availableLen - prefix.length

            if (newAvailable > 10) { // Only if we have space for some title
                let subTrunk = rawTitle.substring(0, newAvailable)
                const lastSp = subTrunk.lastIndexOf(' ')
                if (lastSp > 0) subTrunk = subTrunk.substring(0, lastSp)
                truncatedTitle = `${prefix}${subTrunk}`
            } else {
                // Not enough space even for prefix? Just use Keyword + Brand
                truncatedTitle = `${bestKeyword.charAt(0).toUpperCase() + bestKeyword.slice(1)}`
            }
        }

        const generatedTitle = `${truncatedTitle}${brandSuffix}`

        // 5. Generate Meta Description
        const textContent = rawText.replace(/\s+/g, ' ').trim()
        let generatedDesc = textContent.substring(0, 155)
        const lastDot = generatedDesc.lastIndexOf('.')
        const lastSpace = generatedDesc.lastIndexOf(' ')
        if (lastDot > 100) generatedDesc = generatedDesc.substring(0, lastDot + 1)
        else if (lastSpace > 100) generatedDesc = generatedDesc.substring(0, lastSpace) + '...'
        else generatedDesc += '...'

        onChange({
            ...data,
            focus_keyword: bestKeyword,
            meta_title: generatedTitle,
            meta_description: generatedDesc
        })
    }

    const getScoreColor = () => {
        if (score >= 70) return 'bg-green-500'
        if (score >= 40) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Gestión SEO</h3>
                <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${getScoreColor()}`}></div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300" title="Puntuación de optimización SEO">{score}/100</span>
                </div>
            </div>

            <div className="mb-6">
                <Button
                    type="button"
                    variant="primary"
                    onClick={robustGenerateSEO}
                    className="w-full justify-center"
                    disabled={!postTitle}
                    title="Analizar título y contenido para generar automáticamente palabra clave, meta título y descripción."
                >
                    Generar SEO Automático
                </Button>
            </div>

            <div className="space-y-4">
                {/* Keyword */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" title="La frase principal por la que quieres que encuentren este artículo">
                        Palabra Clave Principal
                        <span className="ml-1 text-gray-400 cursor-help">ⓘ</span>
                    </label>
                    <input
                        type="text"
                        name="focus_keyword"
                        value={data.focus_keyword}
                        onChange={handleChange}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        placeholder="Ej: control ginecológico"
                    />
                </div>

                {/* Title */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" title="El título que aparecerá en los resultados de Google (Max 60 caracteres)">
                            Título SEO
                            <span className="ml-1 text-gray-400 cursor-help">ⓘ</span>
                        </label>
                        <span className={`text-xs ${data.meta_title.length > 60 ? 'text-red-500' : 'text-gray-500'}`}>
                            {data.meta_title.length}/60
                        </span>
                    </div>
                    <input
                        type="text"
                        name="meta_title"
                        value={data.meta_title}
                        onChange={handleChange}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    />
                </div>

                {/* Description */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" title="Breve resumen que aparece bajo el título en Google (Max 160 caracteres)">
                            Meta Descripción
                            <span className="ml-1 text-gray-400 cursor-help">ⓘ</span>
                        </label>
                        <span className={`text-xs ${data.meta_description.length > 160 ? 'text-red-500' : 'text-gray-500'}`}>
                            {data.meta_description.length}/160
                        </span>
                    </div>
                    <textarea
                        name="meta_description"
                        rows={3}
                        value={data.meta_description}
                        onChange={handleChange}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border resize-none"
                    />
                </div>

                {/* Index/Follow */}
                <div className="flex gap-4 pt-2">
                    <div className="flex items-center" title="Permitir que los buscadores muestren esta página">
                        <input
                            id="robots_index"
                            name="robots_index"
                            type="checkbox"
                            checked={data.robots_index}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="robots_index" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Indexar (Index)</label>
                    </div>
                    <div className="flex items-center" title="Permitir que los buscadores sigan los enlaces de esta página">
                        <input
                            id="robots_follow"
                            name="robots_follow"
                            type="checkbox"
                            checked={data.robots_follow}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="robots_follow" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Seguir (Follow)</label>
                    </div>
                </div>

                {/* Validation Feedback */}
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs space-y-1 mt-4 border border-gray-100 dark:border-gray-700">
                    {validations.map((check, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${check.status === 'success' ? 'bg-green-500' :
                                check.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></span>
                            <span className={
                                check.status === 'success' ? 'text-gray-600 dark:text-gray-400' :
                                    check.status === 'warning' ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400 font-medium'
                            }>{check.msg}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}



