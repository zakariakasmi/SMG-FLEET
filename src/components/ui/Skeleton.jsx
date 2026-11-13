export default function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      style={style}
    />
  )
}