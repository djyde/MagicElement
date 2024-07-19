import styleText from 'data-text:./content.css'
import { AnimatePresence, motion } from 'framer-motion'
import { debounce } from 'lodash'
import type { PlasmoGetStyle } from 'plasmo'
import React, { useEffect, useRef } from 'react'
import { OpenAI } from 'openai'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

const proctectedClassName = '__helper__'

const openai = new OpenAI({
  apiKey: "...",
  dangerouslyAllowBrowser: true
})

const getReplaceHTML = async (question: string, html: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        "role": "system",
        "content": [
          {
            "type": "text",
            "text": "You are an HTML expert. I will give you some HTML source code and what I want to rewrite. Please rewrite the entire HTML code to me, and follow the rules:\n\n1. Don't use existed class name, use style attribute to change css style\n2.Don't change the existed class names and HTML attribute\n\nOnly answer the HTML code (not markdown)"
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": html
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": question
          }
        ]
      },
    ],
    temperature: 1,
    max_tokens: 4096,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  return response.choices[0].message.content
}


function useSelection(options?: {
  isEnabled?: boolean
}) {
  const [selectedElement, setSelectedElement] = React.useState<HTMLElement | null>(null)
  const selectedElementRef = useRef<HTMLElement | null>(null)
  const [html, setHTML] = React.useState<string | null>(null)
  const cleanupRef = useRef<() => void>()

  useEffect(() => {
    if (!options?.isEnabled) {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
      return
    }

    const cleanup = enableElementSelection(proctectedClassName)
    cleanupRef.current = cleanup
    return cleanup
  }, [options?.isEnabled])

  function enableElementSelection(excludeClassName) {
    let hoveredElement: HTMLElement | null = null;

    function preventDefault(event) {
      event.preventDefault();
    }

    function isSelectableElement(element) {
      let currentElement = element;
      console.log(currentElement.tagName)
      // if currentElement tag name is plasmo-ui
      if (currentElement.tagName === 'PLASMO-CSUI') {
        return false
      }

      while (currentElement !== null) {
        if (currentElement.classList.contains(excludeClassName)) {
          return false;
        }
        currentElement = currentElement.parentElement;
      }
      return true;
    }

    function highlightElement(element) {
      element.addEventListener('click', preventDefault)
      element.style.outline = '2px solid red';
    }

    function removeHighlight(element) {
      element.style.outline = '';
      element.removeEventListener('click', preventDefault)
    }

    function handleMouseOver(event) {
      if (!isSelectableElement(event.target)) return;

      if (hoveredElement && hoveredElement !== event.target) {
        removeHighlight(hoveredElement);
      }
      hoveredElement = event.target;
      highlightElement(hoveredElement);
    }

    function handleMouseOut(event) {
      if (!isSelectableElement(event.target)) return;

      if (hoveredElement === event.target) {
        removeHighlight(hoveredElement);
        hoveredElement = null;
      }
    }

    function handleClick(event) {
      if (!isSelectableElement(event.target)) return;

      if (selectedElementRef.current) {
        selectedElementRef.current.style.backgroundColor = '';
      }
      setSelectedElement(event.target)

      const node = (event.target as HTMLElement).cloneNode(true) as HTMLElement
      // reset style
      node.style.outline = ''
      node.style.backgroundColor = ''

      setHTML(node.outerHTML)

      selectedElementRef.current = event.target as HTMLElement;
      selectedElementRef.current!.style.backgroundColor = 'yellow';
    }

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick);

    return function cleanup() {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick);
    };
  }

  return {
    selectedElement,
    html
  }
}

const queryClient = new QueryClient()

function Providers(props: {
  children: React.ReactNode
}) {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </>
  )
}

function App() {
  const [enabled, setEnabled] = React.useState(false)
  const { selectedElement, html } = useSelection({
    isEnabled: enabled
  })

  useEffect(() => {
    if (selectedElement) {
      console.log(selectedElement.outerHTML)
    }
  }, [selectedElement])

  const askingMutation = useMutation({
    mutationFn: async (data: {
      question: string
    }) => {
      if (html) {
        const code = await getReplaceHTML(data.question, html)
        // set code to selectedElement
        selectedElement!.outerHTML = code
      }
    }
  })

  return (
    <>
      <div className='fixed right-0 bottom-0'>
        <button onClick={_ => {
          setEnabled(!enabled)
        }}>{enabled ? "On" : "Off"}</button>
      </div>
      <AnimatePresence>
        {selectedElement && (
          <motion.div
            initial={{
              y: 20,
              opacity: 0
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -20
            }}
            className='fixed bottom-0 left-0 right-0 flex justify-center pb-12 gap-2'>
            <form onSubmit={e => {
              e.preventDefault()
              const question = e.currentTarget.question.value
              askingMutation.mutate({
                question
              })
            }} className='flex gap-3 items-center'>
              <div>
                <input name="question" autoFocus placeholder='What do you want to change?' className=' outline-purple-500 border-purple-600 border-2 rounded-full shadow-xl w-[400px] px-4 py-2' />
                <button type="button" className='bg-purple-500 border-purple-700 border-2 text-white rounded-full text-sm px-3 py-2 font-medium'>{askingMutation.isPending ? "Thinking..." : "Ask"}</button>
              </div>
              <div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default function () {
  return (
    <Providers>
      <App />
    </Providers>
  )
}