import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function UsbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2h8v6H8z" />
      <path d="M6 8h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M10 4v2" />
      <path d="M14 4v2" />
    </Icon>
  )
}
