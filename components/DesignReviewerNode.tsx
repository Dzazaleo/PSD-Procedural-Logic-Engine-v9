import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps, useEdges, NodeResizer, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { PSDNodeData, TransformedPayload, ReviewerInstanceState, ReviewerStrategy } from '../types';
import { useProceduralStore } from '../store/ProceduralContext';
import { BrainCircuit, Activity, ShieldCheck, Move, Maximize, RotateCw, CheckCircle2 } from 'lucide-react';

// --- Subcomponent: Nudge Matrix ---
const NudgeMatrix: React.FC<{ strategy: ReviewerStrategy | null }> = ({ strategy }) => {
    if (!strategy) return null;
    
    const overrides = strategy.overrides || [];
    return (
        <div className="bg-slate-950/80 border border-emerald-500/20 rounded p-2 mt-2 space-y-1">
            <div className="flex justify-between items-center border-b border-emerald-900/50 pb-1 mb-1">
                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Aesthetic Deltas</span>
                <span className="text-[8px] text-emerald-600 font-mono">{overrides.length} Layers Polished</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
                <div className="flex flex-col bg-emerald-950/20 p-1 rounded">
                    <span className="text-[7px] text-emerald-600 uppercase">Pos</span>
                    <ShieldCheck className="w-2.5 h-2.5 mx-auto my-0.5 text-emerald-400" />
                </div>
                <div className="flex flex-col bg-emerald-950/20 p-1 rounded">
                    <span className="text-[7px] text-emerald-600 uppercase">Scale</span>
                    <Maximize className="w-2.5 h-2.5 mx-auto my-0.5 text-emerald-400" />
                </div>
                <div className="flex flex-col bg-emerald-950/20 p-1 rounded">
                    <span className="text-[7px] text-emerald-600 uppercase">Rot</span>
                    <RotateCw className="w-2.5 h-2.5 mx-auto my-0.5 text-emerald-400" />
                </div>
                <div className="flex flex-col bg-emerald-950/20 p-1 rounded">
                    <span className="text-[7px] text-emerald-600 uppercase">Sync</span>
                    <Activity className="w-2.5 h-2.5 mx-auto my-0.5 text-emerald-500 animate-pulse" />
                </div>
            </div>
        </div>
    );
};

// --- Subcomponent: Instance Row ---
const ReviewerInstanceRow: React.FC<{
    index: number;
    state: ReviewerInstanceState;
    incomingPayload: TransformedPayload | null;
    onReview: (index: number) => void;
}> = ({ index, state, incomingPayload, onReview }) => {
    const isReady = !!incomingPayload;
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Isolated Scroll
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => e.stopPropagation();
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <div className="relative border-b border-emerald-900/30 bg-slate-900/20 p-3 space-y-3">
            {/* Headers & Wiring */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                    <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">
                        {incomingPayload?.targetContainer || `Auditor ${index + 1}`}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <Handle type="target" position={Position.Left} id={`payload-in-${index}`} className="!static !w-2.5 !h-2.5 !bg-indigo-500 !border-slate-900" title="Input: Transformed Payload" />
                    <Handle type="target" position={Position.Left} id={`target-in-${index}`} className="!static !w-2.5 !h-2.5 !bg-emerald-500 !border-slate-900" title="Input: Target Definition" />
                </div>
            </div>

            {/* Audit Console */}
            <div 
                ref={chatContainerRef}
                className="h-32 bg-black/40 border border-emerald-900/50 rounded p-2 overflow-y-auto custom-scrollbar font-mono text-[9px] leading-tight space-y-2 cursor-auto"
                onMouseDown={e => e.stopPropagation()}
            >
                {state.chatHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-emerald-900/50 italic">
                        [WAITING_FOR_PAYLOAD_READY]
                    </div>
                ) : (
                    state.chatHistory.map((msg, i) => (
                        <div key={i} className={msg.role === 'model' ? 'text-emerald-400' : 'text-slate-500'}>
                            <span className="mr-1">[{msg.role.toUpperCase()}]</span>
                            {msg.parts[0].text}
                        </div>
                    ))
                )}
            </div>

            {/* Metrics & Output */}
            <div className="flex items-end justify-between space-x-4">
                <div className="flex-1">
                    <NudgeMatrix strategy={state.reviewerStrategy} />
                </div>
                <div className="flex flex-col items-end space-y-2">
                    <button 
                        onClick={() => onReview(index)}
                        disabled={!isReady}
                        className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}
                    >
                        Reconcile
                    </button>
                    <div className="relative">
                        <span className="text-[7px] text-emerald-700 font-mono mr-5">POLISHED_OUT</span>
                        <Handle type="source" position={Position.Right} id={`polished-out-${index}`} className="!absolute !right-[-8px] !top-1/2 !-translate-y-1/2 !w-3 !h-3 !bg-white !border-emerald-500" title="Output: Aesthetic Sign-off" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DesignReviewerNode = memo(({ id, data }: NodeProps<PSDNodeData>) => {
  const instanceCount = data.instanceCount || 1;
  const reviewerInstances = data.reviewerInstances || {};
  
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { payloadRegistry, registerReviewerPayload, unregisterNode } = useProceduralStore();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, instanceCount, updateNodeInternals]);

  useEffect(() => {
    return () => unregisterNode(id);
  }, [id, unregisterNode]);

  const getIncomingPayload = useCallback((index: number) => {
    const edges = useEdges();
    const edge = edges.find(e => e.target === id && e.targetHandle === `payload-in-${index}`);
    if (!edge) return null;
    const nodePayloads = payloadRegistry[edge.source];
    return nodePayloads ? nodePayloads[edge.sourceHandle || ''] : null;
  }, [id, payloadRegistry]);

  const handleReview = (index: number) => {
      // Logic for AI Polishing call will be in Phase 3
      console.log(`CARO: Commencing Audit for Instance ${index}`);
  };

  const addInstance = () => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, instanceCount: instanceCount + 1 } } : n));
  };

  return (
    <div className="w-[400px] bg-slate-900 rounded-lg shadow-2xl border border-emerald-500/50 font-sans flex flex-col overflow-hidden">
      <NodeResizer minWidth={400} minHeight={300} isVisible={true} lineStyle={{ border: 'none' }} handleStyle={{ background: 'transparent' }} />
      
      {/* Header */}
      <div className="bg-emerald-950/80 p-2 border-b border-emerald-500/30 flex items-center justify-between">
         <div className="flex items-center space-x-2">
           <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
           <div className="flex flex-col leading-none">
             <span className="text-sm font-bold text-emerald-100 tracking-tight">Design Reviewer</span>
             <span className="text-[9px] text-emerald-500/70 font-mono">PERSONA: CARO</span>
           </div>
         </div>
         <div className="px-1.5 py-0.5 rounded border border-emerald-500/50 bg-emerald-500/10 text-[8px] text-emerald-400 font-bold uppercase tracking-widest">
            Audit Gate
         </div>
      </div>

      <div className="flex flex-col">
          {Array.from({ length: instanceCount }).map((_, i) => (
              <ReviewerInstanceRow 
                key={i} index={i} 
                state={reviewerInstances[i] || { chatHistory: [], reviewerStrategy: null }}
                incomingPayload={getIncomingPayload(i)}
                onReview={handleReview}
              />
          ))}
      </div>

      <button onClick={addInstance} className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-emerald-600 hover:text-emerald-400 text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center space-x-2 border-t border-emerald-900/50">
          <Move className="w-3 h-3" />
          <span>Add Audit Instance</span>
      </button>
    </div>
  );
});