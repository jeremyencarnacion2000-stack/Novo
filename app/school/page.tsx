'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseCard } from '@/components/school/course-card';
import { CourseDialog } from '@/components/school/course-dialog';
import { GradeDialog } from '@/components/school/grade-dialog';
import { GPADisplay } from '@/components/school/gpa-display';
import { useToast } from '@/hooks/use-toast';

const SchoolAnalytics = dynamic(
  () => import('@/components/school/school-analytics').then((mod) => mod.SchoolAnalytics),
  { ssr: false }
);
import { calculateGPA } from '@/lib/gpa-calculator';

import { Course, Grade } from '@/types/school';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { motion } from 'framer-motion';
import { springConfig } from '@/lib/design-tokens';

export default function SchoolPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>();
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>();
  const [educationFilter, setEducationFilter] = useState<string>('all');
  const [schoolTab, setSchoolTab] = useState<string>('courses');

  // Fetch courses
  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/school/courses');
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load courses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Create course
  const handleCreateCourse = async (course: any) => {
    try {
      const response = await fetch('/api/school/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course),
      });

      if (!response.ok) throw new Error('Failed to create course');

      toast({ title: 'Course created successfully' });
      fetchCourses();
    } catch (error) {
      console.error('Error creating course:', error);
      toast({
        title: 'Error',
        description: 'Failed to create course',
        variant: 'destructive',
      });
    }
  };

  // Update course
  const handleUpdateCourse = async (course: Course) => {
    try {
      const response = await fetch(`/api/school/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course),
      });

      if (!response.ok) throw new Error('Failed to update course');

      toast({ title: 'Course updated successfully' });
      fetchCourses();
    } catch (error) {
      console.error('Error updating course:', error);
      toast({
        title: 'Error',
        description: 'Failed to update course',
        variant: 'destructive',
      });
    }
  };

  // Delete course
  const handleDeleteCourse = async (id: string) => {
    try {
      const response = await fetch(`/api/school/courses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete course');

      toast({ title: 'Course deleted successfully' });
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete course',
        variant: 'destructive',
      });
    }
  };

  // Add grade
  const handleAddGrade = async (grade: any) => {
    try {
      const response = await fetch('/api/school/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grade),
      });

      if (!response.ok) throw new Error('Failed to add grade');

      toast({ title: 'Grade added successfully' });
      fetchCourses();
    } catch (error) {
      console.error('Error adding grade:', error);
      toast({
        title: 'Error',
        description: 'Failed to add grade',
        variant: 'destructive',
      });
    }
  };

  const handleSaveCourse = (course: any) => {
    if (editingCourse) {
      handleUpdateCourse({ ...course, id: editingCourse.id });
    } else {
      handleCreateCourse(course);
    }
    setEditingCourse(undefined);
  };

  // The dialogs fire their own modalFlip.toggle() once mounted (calling it
  // here raced the render: the flip target didn't exist yet, so it always
  // fell back to a plain reveal with no animation).
  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseDialogOpen(true);
  };

  const handleOpenNewCourse = () => {
    setEditingCourse(undefined);
    setCourseDialogOpen(true);
  };

  const handleAddGradeClick = (course: Course) => {
    setSelectedCourse(course);
    setGradeDialogOpen(true);
  };

  // CourseDialog/GradeDialog already play their own return flight before
  // calling these (via useModalFlip) — wrapping again here would
  // double-untoggle and delay the unmount by a second, redundant animation.
  const handleCloseCourseDialog = () => {
    setCourseDialogOpen(false);
    setEditingCourse(undefined);
  };

  const handleCloseGradeDialog = () => {
    setGradeDialogOpen(false);
    setSelectedCourse(undefined);
  };

  // Calculate GPAs
  const overallGPA = calculateGPA(courses as any);
  const currentSemester = courses.length > 0
    ? `${courses[0].semester} ${courses[0].year}`
    : 'No semester';
  const currentSemesterCourses = (courses as any[]).filter(
    (c: any) => c.semester === courses[0]?.semester && c.year === courses[0]?.year
  );
  const semesterGPA = calculateGPA(currentSemesterCourses as any);
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits ?? 0), 0);

  // Filtered courses
  const filteredCourses = educationFilter === 'all'
    ? courses
    : courses.filter(c => c.educationType === educationFilter);

  // Separate GPAs
  const universityCourses = courses.filter(c => c.educationType === 'university');
  const highSchoolCourses = courses.filter(c => c.educationType === 'high_school');
  const universityGPA = calculateGPA(universityCourses as any);
  const highSchoolGPA = calculateGPA(highSchoolCourses as any);

  if (loading) {
    return (
      <div>Loading...</div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <ScrollReveal>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">School</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track your courses, grades, and GPA
          </p>
        </div>
      </ScrollReveal>

      {/* GPA Overview */}
      <ScrollReveal delay={0.05}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GPADisplay gpa={overallGPA} label="Overall GPA" />
        <GPADisplay gpa={universityGPA} label="University GPA" />
        <GPADisplay gpa={highSchoolGPA} label="High School GPA" />
      </div>
      </ScrollReveal>

      {/* Tabs */}
      <Tabs value={schoolTab} onValueChange={setSchoolTab} className="w-full">
        <TabsList className="relative grid w-full grid-cols-2 max-w-full sm:max-w-[400px] bg-foreground/5 border border-foreground/5 rounded-full p-1 h-11">
          <TabsTrigger
            value="courses"
            className="relative h-9 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {schoolTab === 'courses' && (
              <motion.div
                layoutId="active-school-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={springConfig.smooth}
              />
            )}
            <span className="relative z-10">Courses</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="relative h-9 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {schoolTab === 'analytics' && (
              <motion.div
                layoutId="active-school-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={springConfig.smooth}
              />
            )}
            <span className="relative z-10">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <Tabs value={educationFilter} onValueChange={setEducationFilter} className="w-full md:w-auto">
              <TabsList className="relative bg-foreground/5 border border-foreground/5 rounded-full p-1 h-11">
                {(['all', 'university', 'high_school'] as const).map((val) => (
                  <TabsTrigger
                    key={val}
                    value={val}
                    className="relative h-9 px-4 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
                  >
                    {educationFilter === val && (
                      <motion.div
                        layoutId="active-education-filter-tab"
                        className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                        transition={springConfig.smooth}
                      />
                    )}
                    <span className="relative z-10">
                      {val === 'all' ? 'All' : val === 'university' ? 'University' : 'High School'}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              data-flip-from="btn-add-course"
              onClick={handleOpenNewCourse}
            >
              <Plus data-shared-item="icon" className="h-4 w-4 mr-2" />
              <span data-shared-item="text">Add Course</span>
            </Button>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No courses yet</p>
              <p className="text-sm mt-2">Add your first course to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springConfig.gentle, delay: Math.min(i, 12) * 0.06 }}
                >
                  <CourseCard
                    course={course}
                    onEdit={handleEditCourse}
                    onDelete={handleDeleteCourse}
                    onAddGrade={handleAddGradeClick}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <SchoolAnalytics courses={courses} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CourseDialog
        open={courseDialogOpen}
        onClose={handleCloseCourseDialog}
        onSave={handleSaveCourse}
        course={editingCourse}
      />

      {selectedCourse && selectedCourse.id && (
        <GradeDialog
          open={gradeDialogOpen}
          onClose={handleCloseGradeDialog}
          onSave={handleAddGrade}
          courseId={selectedCourse.id}
        />
      )}
    </div>
  );
}