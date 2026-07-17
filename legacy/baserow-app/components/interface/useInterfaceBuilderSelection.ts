"use client"

import { useReducer, useCallback } from "react"

export interface SelectionState {
  selectedBlockId: string | null
  selectedBlockIds: Set<string>
  openRecordInEditModeForBlock: {
    blockId: string
    recordId: string
    tableId: string
  } | null
}

type SelectionAction =
  | { type: "SELECT_BLOCK"; blockId: string | null }
  | { type: "SET_SELECTED_BLOCK_IDS"; blockIds: Set<string> }
  | { type: "OPEN_RECORD_FOR_LAYOUT_EDIT"; blockId: string; recordId: string; tableId: string }
  | { type: "CLOSE_RECORD_FOR_LAYOUT_EDIT" }
  | { type: "CLEAR_SELECTION" }

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.blockId }
    case "SET_SELECTED_BLOCK_IDS":
      return { ...state, selectedBlockIds: action.blockIds }
    case "OPEN_RECORD_FOR_LAYOUT_EDIT":
      return {
        ...state,
        openRecordInEditModeForBlock: {
          blockId: action.blockId,
          recordId: action.recordId,
          tableId: action.tableId,
        },
      }
    case "CLOSE_RECORD_FOR_LAYOUT_EDIT":
      return { ...state, openRecordInEditModeForBlock: null }
    case "CLEAR_SELECTION":
      return {
        ...state,
        selectedBlockId: null,
        selectedBlockIds: new Set(),
      }
    default:
      return state
  }
}

const initialState: SelectionState = {
  selectedBlockId: null,
  selectedBlockIds: new Set(),
  openRecordInEditModeForBlock: null,
}

export function useInterfaceBuilderSelection() {
  const [state, dispatch] = useReducer(selectionReducer, initialState)

  const setSelectedBlockId = useCallback((blockId: string | null) => {
    dispatch({ type: "SELECT_BLOCK", blockId })
  }, [])

  const setSelectedBlockIds = useCallback((blockIds: Set<string>) => {
    dispatch({ type: "SET_SELECTED_BLOCK_IDS", blockIds })
  }, [])

  const setOpenRecordInEditModeForBlock = useCallback(
    (value: { blockId: string; recordId: string; tableId: string } | null) => {
      if (value) {
        dispatch({ type: "OPEN_RECORD_FOR_LAYOUT_EDIT", ...value })
      } else {
        dispatch({ type: "CLOSE_RECORD_FOR_LAYOUT_EDIT" })
      }
    },
    []
  )

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" })
  }, [])

  return {
    selectedBlockId: state.selectedBlockId,
    selectedBlockIds: state.selectedBlockIds,
    openRecordInEditModeForBlock: state.openRecordInEditModeForBlock,
    setSelectedBlockId,
    setSelectedBlockIds,
    setOpenRecordInEditModeForBlock,
    clearSelection,
  }
}
