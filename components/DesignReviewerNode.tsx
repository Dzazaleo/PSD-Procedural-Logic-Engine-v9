import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useEdges, useReactFlow } from 'reactflow';
import { PSDNodeData, ReviewerInstanceState, TransformedPayload, ChatMessage, ReviewerStrategy, LayerOverride } from '../types';
import { useProceduralStore } from '../store/ProceduralContext';
import { Microscope, ScanEye, Activity, CheckCircle2, RotateCw, Move, Maximize, ArrowRight, MousePointer2 } from 'lucide-react';

const DEFAULT_REVIEWER_STATE: ReviewerInstanceState = {
    chatHistory: [],
    reviewerStrategy: null
};

// --- SUBCOMPONENT: Audit Console ---
const AuditConsole: React.FC<{ history: ChatMessage[], isPolishing: boolean }> = ({ history, isPolishing }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, isPolishing]);

    // Native Wheel Isolation to prevent canvas zooming
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => { e.stopPropagation(); };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => { container.removeEventListener('wheel', handleWheel); };
    }, []);

    return (
        <div 
            ref={scrollRef}
            className="h-32 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] p-2 overflow-y-auto custom-scrollbar shadow-inner relative nodrag nopan cursor-text"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {history.length === 0 && !isPolishing && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-700 pointer-events-none">
                    <span className="flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        SYSTEM READY. WAITING FOR INPUT...
                    </span>
                </div>
            )}
            
            {history.map((msg, i) => (
                <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-emerald-500/80 text-right' : 'text-slate-300 text-left'}`}>
                    <span className="opacity-50 text-[8px] block mb-0.5">
                        [{new Date(msg.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}]
                        {msg.role === 'user' ? ' OP_CMD' : ' CARO_SYS'}
                    </span>
                    <div className={`inline-block px-2 py-1 rounded ${msg.role === 'user' ? 'bg-emerald-900/10 border border-emerald-900/30' : 'bg-slate-800 border border-slate-700'}`}>
                        {msg.parts[0].text}
                    </div>
                </div>
            ))}

            {isPolishing && (
                <div className="text-emerald-400 animate-pulse flex items-center gap-1 mt-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span>CALCULATING OPTICAL RECONCILIATION...</span>
                </div>
            )}
        </div>
    );
};

// --- SUBCOMPONENT: Nudge Matrix ---
const NudgeMatrix: React.FC<{ strategy: ReviewerStrategy | null }> = ({ strategy }) => {
    // If no strategy, show empty state or zeros
    // We aggregate metrics to show "Net Activity"
    const overrides = strategy?.overrides || [];
    const count = overrides.length;
    
    // Calculate averages/max just for visualization
    const maxTrans = useMemo(() => {
        if (!count) return { x: 0, y: 0, s: 0, r: 0 };
        return overrides.reduce((acc, curr) => ({
            x: Math.max(acc.x, Math.abs(curr.xOffset)),
            y: Math.max(acc.y, Math.abs(curr.yOffset)),
            s: Math.max(acc.s, Math.abs(1 - curr.individualScale)),
            r: Math.max(acc.r, Math.abs(curr.rotation || 0))
        }), { x: 0, y: 0, s: 0, r: 0 });
    }, [overrides, count]);

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded p-2 flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MousePointer2 className="w-3 h-3" /> Offset Matrix
                </span>
                <span className={`text-[9px] font-mono ${count > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {count} Active Nodes
                </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
                {/* Scale */}
                <div className="bg-slate-800 p-1 rounded border border-slate-700/50 flex flex-col items-center">
                    <Maximize className="w-3 h-3 text-blue-400 mb-1" />
                    <span className="text-[8px] text-slate-500 uppercase">Scale Δ</span>
                    <span className={`text-[10px] font-mono font-bold ${maxTrans.s > 0 ? 'text-blue-300' : 'text-slate-600'}`}>
                        {maxTrans.s > 0 ? `±${(maxTrans.s * 100).toFixed(1)}%` : '--'}
                    </span>
                </div>

                {/* X Axis */}
                <div className="bg-slate-800 p-1 rounded border border-slate-700/50 flex flex-col items-center">
                    <Move className="w-3 h-3 text-pink-400 mb-1 rotate-90" />
                    <span className="text-[8px] text-slate-500 uppercase">Pos X Δ</span>
                    <span className={`text-[10px] font-mono font-bold ${maxTrans.x > 0 ? 'text-pink-300' : 'text-slate-600'}`}>
                        {maxTrans.x > 0 ? `±${Math.round(maxTrans.x)}px` : '--'}
                    </span>
                </div>

                {/* Y Axis */}
                <div className="bg-slate-800 p-1 rounded border border-slate-700/50 flex flex-col items-center">
                    <Move className="w-3 h-3 text-purple-400 mb-1" />
                    <span className="text-[8px] text-slate-500 uppercase">Pos Y Δ</span>
                    <span className={`text-[10px] font-mono font-bold ${maxTrans.y > 0 ? 'text-purple-300' : 'text-slate-600'}`}>
                        {maxTrans.y > 0 ? `±${Math.round(maxTrans.y)}px` : '--'}
                    </span>
                </div>

                {/* Rotation */}
                <div className="bg-slate-800 p-1 rounded border border-slate-700/50 flex flex-col items-center">
                    <RotateCw className="w-3 h-3 text-emerald-400 mb-1" />
                    <span className="text-[8px] text-slate-500 uppercase">Rot Δ</span>
                    <span className={`text-[10px] font-mono font-bold ${maxTrans.r > 0 ? 'text-emerald-300' : 'text-slate-600'}`}>
                        {maxTrans.r > 0 ? `±${Math.round(maxTrans.r)}°` : '--'}
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- SUBCOMPONENT: Instance Row ---
const InstanceRow = memo(({ 
    index, 
    nodeId,
    state,
    onPolish,
    isPolishing
}: { 
    index: number, 
    nodeId: string,
    state: ReviewerInstanceState,
    onPolish: (index: number) => void,
    isPolishing: boolean
}) => {
    // We need to resolve connection status for UI feedback
    // This logic duplicates some store lookups but keeps the UI responsive to connection state
    const edges = useEdges();
    const { payloadRegistry, templateRegistry, registerReviewerPayload } = useProceduralStore();
    
    // 1. Resolve Payload Input
    const payloadEdge = edges.find(e => e.target === nodeId && e.targetHandle === `payload-in-${index}`);
    const upstreamPayload = payloadEdge ? payloadRegistry[payloadEdge.source]?.[payloadEdge.sourceHandle || ''] : null;
    
    // 2. Resolve Target Input
    const targetEdge = edges.find(e => e.target === nodeId && e.targetHandle === `target-in-${index}`);
    // Simplified target name resolution for UI
    const targetName = targetEdge ? (targetEdge.sourceHandle || 'Target') : null;

    // 3. Effect: Auto-propagate if no strategy (Pass-through mode)
    // Or Apply Strategy if exists
    useEffect(() => {
        if (!upstreamPayload) return;

        let polishedPayload = { ...upstreamPayload };

        if (state.reviewerStrategy?.overrides) {
            // APPLY STRATEGY (Deep Clone & Mutate)
            // This is a lightweight simulation of the "Polish" application
            // In a real implementation, we would traverse the tree and apply the deltas
            // For now, we mainly mark it as polished and attach the strategy metadata
            polishedPayload.isPolished = true;
            // TODO: Actual tree traversal transformation logic goes here
            // For Phase 2, we just pass through but mark strictly as polished
        } else {
            // Pass-through mode
            polishedPayload.isPolished = false; 
        }

        // Register output to store
        registerReviewerPayload(nodeId, `polished-out-${index}`, polishedPayload);

    }, [upstreamPayload, state.reviewerStrategy, nodeId, index, registerReviewerPayload]);

    return (
        <div className="border-b border-slate-800 bg-slate-950/50 p-3 space-y-3 first:rounded-t-none last:border-0">
            {/* Header / Wiring Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 group">
                             <Handle 
                                type="target" 
                                position={Position.Left} 
                                id={`payload-in-${index}`} 
                                className={`!w-3 !h-3 !-left-4 !border-2 transition-colors duration-300 ${upstreamPayload ? '!bg-indigo-500 !border-white' : '!bg-slate-700 !border-slate-500'}`} 
                             />
                             <span className={`text-[9px] font-bold uppercase tracking-wider ${upstreamPayload ? 'text-indigo-300' : 'text-slate-600'}`}>
                                Input Payload
                             </span>
                        </div>
                        <div className="flex items-center gap-2 group">
                             <Handle 
                                type="target" 
                                position={Position.Left} 
                                id={`target-in-${index}`} 
                                className={`!w-3 !h-3 !-left-4 !border-2 transition-colors duration-300 ${targetName ? '!bg-emerald-500 !border-white' : '!bg-slate-700 !border-slate-500'}`} 
                             />
                             <span className={`text-[9px] font-bold uppercase tracking-wider ${targetName ? 'text-emerald-300' : 'text-slate-600'}`}>
                                {targetName || 'Target Context'}
                             </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 font-mono">OUT &rarr;</span>
                    <div className="relative">
                        <Handle 
                            type="source" 
                            position={Position.Right} 
                            id={`polished-out-${index}`} 
                            className="!w-3 !h-3 !-right-4 !border-2 !bg-white !border-emerald-500 z-50 hover:scale-125 transition-transform" 
                        />
                    </div>
                </div>
            </div>

            {/* Audit Console */}
            <AuditConsole history={state.chatHistory} isPolishing={isPolishing} />

            {/* Nudge Matrix */}
            <NudgeMatrix strategy={state.reviewerStrategy} />

            {/* Action Bar */}
            <div className="flex justify-end pt-1">
                <button
                    onClick={(e) => { e.stopPropagation(); onPolish(index); }}
                    disabled={!upstreamPayload || isPolishing}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all
                        ${!upstreamPayload 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                            : isPolishing 
                                ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/50 cursor-wait'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5'
                        }
                    `}
                >
                    {isPolishing ? <ScanEye className="w-3 h-3 animate-spin" /> : <Microscope className="w-3 h-3" />}
                    <span>{isPolishing ? 'Auditing...' : 'Reconcile'}</span>
                </button>
            </div>
        </div>
    );
});

export const DesignReviewerNode = memo(({ id, data }: NodeProps<PSDNodeData>) => {
    const instanceCount = data.instanceCount || 1;
    const reviewerInstances = data.reviewerInstances || {};
    const [polishingStates, setPolishingStates] = useState<Record<number, boolean>>({});

    const { unregisterNode } = useProceduralStore();
    const { setNodes: updateFlowNodes } = useReactFlow();

    useEffect(() => {
        return () => unregisterNode(id);
    }, [id, unregisterNode]);

    const handlePolish = useCallback((index: number) => {
        // Mock AI Logic for UI Testing (Phase 2)
        setPolishingStates(prev => ({ ...prev, [index]: true }));

        // Simulate async operation
        setTimeout(() => {
            updateFlowNodes((nds) => nds.map((n) => {
                if (n.id === id) {
                    const currentInstances = n.data.reviewerInstances || {};
                    const oldState = currentInstances[index] || DEFAULT_REVIEWER_STATE;
                    
                    // Mock Log & Strategy
                    const newLog: ChatMessage = {
                        id: Date.now().toString(),
                        role: 'model',
                        parts: [{ text: "Analysis Complete. Minor drift detected in sub-group 'Logo'. Applied 0.98x scale correction and -2px Y offset to align with optical center." }],
                        timestamp: Date.now()
                    };

                    const mockStrategy: ReviewerStrategy = {
                        CARO_Audit: "Optical alignment corrected.",
                        overrides: [
                            { layerId: "mock-id", xOffset: 0, yOffset: -2, individualScale: 0.98, rotation: 0 }
                        ]
                    };

                    return {
                        ...n,
                        data: {
                            ...n.data,
                            reviewerInstances: {
                                ...currentInstances,
                                [index]: {
                                    ...oldState,
                                    chatHistory: [...oldState.chatHistory, newLog],
                                    reviewerStrategy: mockStrategy
                                }
                            }
                        }
                    };
                }
                return n;
            }));
            setPolishingStates(prev => ({ ...prev, [index]: false }));
        }, 2000);
    }, [id, updateFlowNodes]);

    const addInstance = useCallback(() => {
        updateFlowNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, instanceCount: (n.data.instanceCount || 1) + 1 } };
            }
            return n;
        }));
    }, [id, updateFlowNodes]);

    return (
        <div className="w-[480px] bg-slate-950 rounded-lg shadow-2xl border border-emerald-500/50 flex flex-col font-sans relative transition-all hover:border-emerald-500">
             <NodeResizer minWidth={480} isVisible={true} handleStyle={{ background: 'transparent', border: 'none' }} lineStyle={{ border: 'none' }} />
            
             {/* Header */}
             <div className="bg-emerald-900/30 p-2 border-b border-emerald-800 flex items-center justify-between rounded-t-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
                <div className="relative z-10 flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-md">
                        <ScanEye className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-emerald-100 tracking-wide">Design Reviewer</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[9px] text-emerald-400 font-mono tracking-wider">CARO_AUDIT_ACTIVE</span>
                        </div>
                    </div>
                </div>
                <div className="text-[9px] font-mono text-emerald-600/50 border border-emerald-900 px-1 rounded">
                    SYS.V.0.9
                </div>
             </div>

             {/* Body */}
             <div className="flex flex-col">
                 {Array.from({ length: instanceCount }).map((_, i) => (
                     <InstanceRow 
                        key={i} 
                        index={i} 
                        nodeId={id} 
                        state={reviewerInstances[i] || DEFAULT_REVIEWER_STATE}
                        onPolish={handlePolish}
                        isPolishing={!!polishingStates[i]}
                     />
                 ))}
             </div>

             {/* Footer Add Button */}
             <button 
                onClick={addInstance}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border-t border-slate-800 text-slate-500 hover:text-emerald-400 transition-colors flex items-center justify-center space-x-1 rounded-b-lg group"
             >
                <div className="p-0.5 rounded border border-slate-700 group-hover:border-emerald-500/50 bg-slate-800">
                    <ArrowRight className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                </div>
                <span className="text-[9px] font-medium uppercase tracking-wider">Add Auditor</span>
             </button>
        </div>
    );
});
