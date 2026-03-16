import { useState, useEffect } from 'react'

const RSS_URL = 'https://snuggledtogetherblog.wordpress.com/feed/'

export default function PatchNotesView({ modpack }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Fetch and filter RSS — main process could do this too, but fetch works in renderer
    fetch(RSS_URL)
      .then(r => r.text())
      .then(xml => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, 'text/xml')
        const items = [...doc.querySelectorAll('item')]
        const filtered = items
          .filter(item => {
            const cats = [...item.querySelectorAll('category')].map(c => c.textContent)
            return !modpack.patchCategory || cats.includes(modpack.patchCategory)
          })
          .map(item => ({
            title: item.querySelector('title')?.textContent,
            link: item.querySelector('link')?.nextSibling?.textContent,
            date: item.querySelector('pubDate')?.textContent,
            description: item.querySelector('description')?.textContent,
          }))
        setPosts(filtered)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [modpack.name])

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading patch notes...</div>
  }

  if (!posts.length) {
    return <div className="p-6 text-sm text-gray-400">No patch notes found for {modpack.name}.</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4 pb-2 border-b border-surface-600">Patch Notes</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post, i) => (
          <a
            key={i}
            href={post.link}
            target="_blank"
            rel="noreferrer"
            className="block bg-surface-800 border border-surface-600 rounded p-4 hover:border-accent
                       transition-colors duration-200 no-underline text-white"
          >
            <h3 className="text-sm font-semibold mb-1 line-clamp-2">{post.title}</h3>
            <p className="text-xs text-gray-500">{new Date(post.date).toLocaleDateString()}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
