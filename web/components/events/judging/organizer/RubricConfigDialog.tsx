"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import {
  fetchRubricsAction,
  upsertRubricCriterionAction,
  deleteRubricCriterionAction,
  EvaluationCriterion,
} from "@/app/actions/judging-rubric.actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface RubricConfigDialogProps {
  eventId: string;
  isCompleted: boolean;
}

export function RubricConfigDialog({ eventId, isCompleted }: RubricConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rubrics, setRubrics] = useState<EvaluationCriterion[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EvaluationCriterion>>({});

  useEffect(() => {
    async function loadRubrics() {
      setLoading(true);
      const data = await fetchRubricsAction(eventId);
      setRubrics(data);
      setLoading(false);
    }

    if (isOpen) {
      loadRubrics();
    }
     
  }, [isOpen, eventId]);

  const handleEdit = (r: EvaluationCriterion) => {
    setEditingId(r.id);
    setEditForm({ ...r });
  };

  const handleAddNew = () => {
    const newId = `new_${Date.now()}`;
    setEditingId(newId);
    setEditForm({
      name: "",
      description: "",
      max_score: 10,
      weight: 1.0,
      sort_order: rubrics.length + 1,
    });
  };

  const handleSave = async () => {
    if (!editForm.name) return alert("Name is required");

    const payload = { ...editForm };
    if (editingId && editingId.startsWith("new_")) {
      delete payload.id;
    }

    const res = await upsertRubricCriterionAction(eventId, payload);
    if (res.success) {
      setEditingId(null);
      loadRubrics();
    } else {
      alert("Failed to save: " + res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this criterion?")) return;
    const res = await deleteRubricCriterionAction(eventId, id);
    if (res.success) {
      loadRubrics();
    } else {
      alert("Failed to delete: " + res.error);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Settings className="w-4 h-4 mr-2" />
        Configure Rubric
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-3xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div>
                <h2 className="text-xl font-semibold">Evaluation Rubric</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Define the criteria judges will use to score submissions.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isCompleted && (
                <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-md mb-4 dark:bg-blue-900/20 dark:text-blue-200">
                  The event is active or completed. Rubrics cannot be modified.
                </div>
              )}

              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading rubrics...</div>
              ) : (
                <div className="space-y-4">
                  {rubrics.length === 0 && !editingId && (
                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                      No criteria defined yet.
                    </div>
                  )}

                  {rubrics.map((r) => (
                    <div key={r.id} className="border rounded-lg p-4 bg-muted/30">
                      {editingId === r.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Name
                              </label>
                              <Input
                                value={editForm.name || ""}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="e.g. Innovation"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Max Score
                                </label>
                                <Input
                                  type="number"
                                  value={editForm.max_score || 0}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, max_score: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Weight
                                </label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={editForm.weight || 0}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, weight: Number(e.target.value) })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Description (Optional)
                            </label>
                            <Textarea
                              value={editForm.description || ""}
                              onChange={(e) =>
                                setEditForm({ ...editForm, description: e.target.value })
                              }
                              placeholder="Instructions for judges on how to score this."
                              className="h-20 resize-none"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{r.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {r.description || "No description provided."}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-xs font-medium text-muted-foreground">
                              <span>Max Score: {r.max_score}</span>
                              <span>Weight: {r.weight}x</span>
                            </div>
                          </div>
                          {!isCompleted && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(r.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* New Item Form inline */}
                  {editingId && editingId.startsWith("new_") && (
                    <div className="border border-primary/50 rounded-lg p-4 bg-primary/5 shadow-sm">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-primary">Name</label>
                            <Input
                              value={editForm.name || ""}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              placeholder="e.g. Design"
                              autoFocus
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-primary">Max Score</label>
                              <Input
                                type="number"
                                value={editForm.max_score || 0}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, max_score: Number(e.target.value) })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-primary">Weight</label>
                              <Input
                                type="number"
                                step="0.1"
                                value={editForm.weight || 0}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, weight: Number(e.target.value) })
                                }
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-primary">
                            Description (Optional)
                          </label>
                          <Textarea
                            value={editForm.description || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            placeholder="Provide guidance to the judges."
                            className="h-20 resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSave}>
                            <Save className="w-4 h-4 mr-2" />
                            Save Criterion
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isCompleted && !editingId && (
                    <Button
                      variant="outline"
                      className="w-full border-dashed py-8 text-muted-foreground hover:text-foreground"
                      onClick={handleAddNew}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Criterion
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t shrink-0 flex justify-between items-center bg-muted/20">
              <div className="text-sm text-muted-foreground font-medium">
                Total Max Points:{" "}
                {rubrics.reduce((acc, r) => acc + r.max_score * r.weight, 0).toFixed(2)}
              </div>
              <Button onClick={() => setIsOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
