import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface CenteredLoaderProps {
  label?: string
  className?: string
  spinnerClassName?: string
}

export function CenteredLoader({
  label = 'Загрузка...',
  className,
  spinnerClassName,
}: CenteredLoaderProps) {
  return (
    <div className={cn('flex min-h-[220px] items-center justify-center px-4 py-10', className)}>
      <div className='flex flex-col items-center gap-3 text-center'>
        <Spinner className={cn('size-6 text-primary', spinnerClassName)} />
        <p className='text-sm text-muted-foreground'>{label}</p>
      </div>
    </div>
  )
}
