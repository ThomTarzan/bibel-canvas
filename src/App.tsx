import { ArrowPanel } from './components/ArrowPanel';
import { CanvasView } from './components/CanvasView';
import { ImportDialog } from './components/ImportDialog';
import { SelectionBar } from './components/SelectionBar';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { EditorProvider, useEditor } from './state/EditorContext';

function Shell() {
  const { selection } = useEditor();
  return (
    <div className="app">
      <CanvasView />
      <TopBar />
      <ArrowPanel />
      <SelectionBar />
      <Toast lifted={selection.length > 0} />
      <ImportDialog />
    </div>
  );
}

export function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  );
}
