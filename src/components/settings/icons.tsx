import {Check, ChevronLeft, ChevronRight, Settings, X} from 'lucide-react'

// Thin wrappers over lucide-react (ISC) that keep the names and default sizes
// used by the settings components. To change an icon, swap the import here.
type Props = {size?: number}

export const GearIcon = ({size = 18}: Props) => (
  <Settings size={size} aria-hidden="true" />
)

export const CheckIcon = ({size = 14}: Props) => (
  <Check size={size} aria-hidden="true" />
)

export const ChevronRightIcon = ({size = 16}: Props) => (
  <ChevronRight size={size} aria-hidden="true" />
)

export const BackIcon = ({size = 18}: Props) => (
  <ChevronLeft size={size} aria-hidden="true" />
)

export const CloseIcon = ({size = 18}: Props) => (
  <X size={size} aria-hidden="true" />
)