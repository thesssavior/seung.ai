"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, AlertTriangle, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface MindmapProps {
  transcript?: string;
  title?: string;
  mindmap: any | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null | undefined;
  isActive: boolean | null;
}

const MindmapComponent: React.FC<MindmapProps> = ({
  transcript,
  title,
  mindmap,
  locale,
  contentLanguage,
  fileId,
  isActive
}) => {
  const t = useTranslations();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reactFlowReady, setReactFlowReady] = useState(false);
  const { fitView } = useReactFlow();
  const hasFit = useRef(false);
  const { user } = useAuth();
  const hasStartedGeneration = useRef(false);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  useEffect(() => {
    if (mindmap) {
      if (mindmap.nodes && Array.isArray(mindmap.nodes) && mindmap.nodes.length > 0) {
        setNodes(mindmap.nodes);
        setEdges(mindmap.edges || []);
        setIsGenerated(true);
      }
    }
  }, [mindmap]);

  useEffect(() => {
    if (reactFlowReady && nodes.length && !hasFit.current && isActive) {
      requestAnimationFrame(() => {
        fitView();
      });
      hasFit.current = true;
    }
  }, [reactFlowReady, nodes, isActive, fitView]);

  useEffect(() => {
    if (transcript && !isGenerated && !isLoading && !hasStartedGeneration.current) {
      hasStartedGeneration.current = true;
      generateMindmap();
    }
  }, [transcript, isGenerated, isLoading]);

  const generateMindmap = async () => {
    if (!transcript) {
      setError("No transcript available to generate mind map.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/files/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title,
          contentLanguage: contentLanguage || locale
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch mindmap data');
      }

      const data = await response.json();
      if (data.nodes && data.edges) {
        const validatedNodes = data.nodes.map((node: Node) => ({
          ...node,
          position: node.position || { x: Math.random() * 400, y: Math.random() * 400 },
          sourcePosition: node.sourcePosition || Position.Right,
          targetPosition: node.targetPosition || Position.Left,
        }));
        setNodes(validatedNodes);
        setEdges(data.edges);
        setIsGenerated(true);
        setIsLoading(false);

        if (!user || !fileId) {
          setIsSaving(false);
          return;
        }

        setIsSaving(true);
        try {
          const saveResponse = await fetch('/api/files/mindmap', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, mindmap: { nodes: validatedNodes, edges: data.edges } }),
          });

          if (!saveResponse.ok) {
            const saveErrData = await saveResponse.json();
            console.error("Failed to save mindmap:", saveErrData.error);
          }
        } finally {
          setIsSaving(false);
        }
      } else {
        throw new Error('Invalid data structure received from mindmap API');
      }
    } catch (err: any) {
      console.error("Error fetching mindmap data:", err);
      setError(err.message || 'An unknown error occurred');
      setIsLoading(false);
    }
  };

  if (!transcript) {
    return (
      <div className="h-full w-full flex items-center justify-center border rounded-md">
        <p className="text-gray-500">{t('Mindmap.noSummaryAvailable')}</p>
      </div>
    );
  }

  if (!isGenerated && !isLoading && !error && !isSaving) {
    return (
      <div className="flex flex-col items-center pt-36 h-full text-center px-4">
        <Brain className="h-10 w-10 text-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('Mindmap.title')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {t('Mindmap.generateMindmapDescription')}
        </p>
        <Button onClick={generateMindmap}>
          {t('Mindmap.generateMindmapButton')}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center pt-36 h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (error || (nodes.length === 0 && !isLoading && !isSaving)) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center rounded-md p-4">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600">Error Generating Mind Map</h3>
        <p className="text-sm text-red-500 text-center">{error}</p>
        <Button onClick={generateMindmap} className="mt-4" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[500px]">
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={() => setReactFlowReady(true)}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
};

const Mindmap: React.FC<MindmapProps> = (props) => (
  <ReactFlowProvider>
    <MindmapComponent {...props} />
  </ReactFlowProvider>
);

export default Mindmap;
