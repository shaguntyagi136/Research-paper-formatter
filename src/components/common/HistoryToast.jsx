export default function HistoryToast({ feedback }) {
  if (!feedback) return null

  return <div className="history-toast" key={feedback.id} role="status" aria-live="polite" aria-atomic="true">{feedback.message}</div>
}
