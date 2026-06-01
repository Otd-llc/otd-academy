-- AddCheckConstraint: project_dependency_no_self_edge
ALTER TABLE "ProjectDependency"
ADD CONSTRAINT project_dependency_no_self_edge
CHECK ("dependentProjectId" <> "dependsOnProjectId");
