'use client'

import Image, { type StaticImageData } from 'next/image'

type DeviceMockupProps = {
  image: StaticImageData
  alt: string
  label: string
  className?: string
  priority?: boolean
}

export function DesktopDeviceMockup({ image, alt, label, className = '', priority = false }: DeviceMockupProps) {
  return (
    <figure className={`relative overflow-hidden rounded-[1.8rem] border border-white/[0.12] bg-[#0A120D] p-1.5 shadow-[0_32px_100px_rgba(0,0,0,0.44)] ${className}`}>
      <div className="flex h-10 items-center justify-between rounded-t-[1.35rem] border-b border-white/[0.07] bg-[#101A14] px-4" aria-hidden="true">
        <div className="flex gap-1.5"><span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" /></div>
        <span className="text-[8px] font-medium uppercase tracking-[0.18em] text-white/42">{label}</span>
        <span className="size-3" />
      </div>
      <div className="overflow-hidden rounded-b-[1.35rem] bg-[#F8F4EA]"><Image src={image} alt={alt} className="h-auto w-full" sizes="(max-width: 1024px) 92vw, 58vw" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} /></div>
    </figure>
  )
}

export function PhoneDeviceMockup({ image, alt, label, className = '', priority = false }: DeviceMockupProps) {
  return (
    <figure className={`relative overflow-hidden rounded-[2rem] border border-white/[0.16] bg-[#08100C] p-1.5 shadow-[0_26px_72px_rgba(0,0,0,0.48)] ${className}`}>
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.62rem] bg-[#F8F4EA]">
        <Image src={image} alt={alt} fill sizes="(max-width: 1024px) 42vw, 260px" className="object-cover object-top" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-7 bg-[linear-gradient(180deg,rgba(5,13,9,.38),transparent)]" />
        <div aria-hidden="true" className="absolute left-1/2 top-2 z-20 h-4 w-[37%] -translate-x-1/2 rounded-full bg-[#07100B]/88" />
      </div>
      <figcaption className="px-2 pb-1.5 pt-2 text-center text-[8px] font-medium uppercase tracking-[0.15em] text-white/45">{label}</figcaption>
    </figure>
  )
}
