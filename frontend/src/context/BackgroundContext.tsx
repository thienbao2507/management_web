/* oxlint-disable react/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { api, type UserBackground } from "@/services/api"

interface BackgroundContextValue {
  background: UserBackground | null
  save: (image: string, dim: number) => Promise<UserBackground>
  setDim: (dim: number) => Promise<UserBackground>
  remove: () => Promise<void>
  dialogOpen: boolean
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null)

interface BackgroundState {
  userId: string
  value: UserBackground | null
}

interface DialogState {
  userId: string
  open: boolean
}

export function BackgroundProvider({
  currentUserId,
  children,
}: {
  currentUserId: string
  children: React.ReactNode
}) {
  const [backgroundState, setBackgroundState] = useState<BackgroundState>({ userId: currentUserId, value: null })
  const [dialogState, setDialogState] = useState<DialogState>({ userId: currentUserId, open: false })
  const activeUserId = useRef(currentUserId)
  const background = backgroundState.userId === currentUserId ? backgroundState.value : null
  const dialogOpen = dialogState.userId === currentUserId && dialogState.open

  useLayoutEffect(() => {
    activeUserId.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    const controller = new AbortController()
    const userId = currentUserId

    void api.getMyBackground(controller.signal).then(
      ({ background: loadedBackground }) => {
        if (!controller.signal.aborted && activeUserId.current === userId) {
          setBackgroundState({ userId, value: loadedBackground })
        }
      },
      () => {
        if (!controller.signal.aborted && activeUserId.current === userId) {
          setBackgroundState({ userId, value: null })
        }
      },
    )

    return () => controller.abort()
  }, [currentUserId])

  const save = useCallback(async (image: string, dim: number) => {
    const userId = currentUserId
    const savedBackground = await api.saveMyBackground({ image, dim })
    if (activeUserId.current === userId) setBackgroundState({ userId, value: savedBackground })
    return savedBackground
  }, [currentUserId])

  const setDim = useCallback(async (dim: number) => {
    const userId = currentUserId
    const savedBackground = await api.updateMyBackgroundDim(dim)
    if (activeUserId.current === userId) setBackgroundState({ userId, value: savedBackground })
    return savedBackground
  }, [currentUserId])

  const remove = useCallback(async () => {
    const userId = currentUserId
    await api.deleteMyBackground()
    if (activeUserId.current === userId) setBackgroundState({ userId, value: null })
  }, [currentUserId])

  const setDialogOpen = useCallback<React.Dispatch<React.SetStateAction<boolean>>>((nextOpen) => {
    setDialogState((previous) => {
      const currentOpen = previous.userId === currentUserId && previous.open
      return {
        userId: currentUserId,
        open: typeof nextOpen === "function" ? nextOpen(currentOpen) : nextOpen,
      }
    })
  }, [currentUserId])

  return (
    <BackgroundContext.Provider value={{ background, save, setDim, remove, dialogOpen, setDialogOpen }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground() {
  const context = useContext(BackgroundContext)
  if (!context) throw new Error("BackgroundProvider is required")
  return context
}
