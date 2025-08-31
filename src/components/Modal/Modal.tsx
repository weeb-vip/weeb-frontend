// react functional component with children
import {Fragment} from "react";
import {Dialog, Transition} from "@headlessui/react";
import Button, {ButtonColor} from "../Button";

export interface ModalProps {
  title: string
  children: React.ReactNode
  isOpen: boolean
  closeFn: () => void
  options?: {
    label: string
    onClick: () => void
  }[]

  className?: string
}

export default function Modal({children, title, isOpen, closeFn, options, className}: ModalProps) {

  return (
    <Transition appear show={isOpen} as={Fragment}>

      <Dialog as="div" className="fixed z-50" onClose={closeFn}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={`fixed inset-0 bg-black bg-opacity-25 ${className || ''}`}/>
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Dialog.Panel
              className="transform rounded-lg text-left align-middle shadow-xl transition-all bg-white dark:bg-gray-800">
              <Dialog.Title>{title}</Dialog.Title>
              <div className="flex justify-between flex-col flex-no-wrap">
                <div className="mt-2">
                  {children}
                </div>
                <div className="flex justify-end mt-4">
                  {options && options.map((option, index) => (
                    <Button key={index} color={ButtonColor.blue} label={option.label} showLabel
                            onClick={option.onClick}/>
                  ))}
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
