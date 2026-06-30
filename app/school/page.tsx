'use client';

import React, { useState, useEffect } from 'react';
import { blendy } from '@/lib/blendy';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseCard } from '@/components/school/course-card';
import { CourseDialog } from '@/components/school/course-dialog';
import { GradeDialog } from '@/components/school/grade-dialog';
import { GPADisplay } from '@/components/school/gpa-display';
import { SchoolAnalytics } from '@/components/school/school-analytics';
import { useToast } from '@/hooks/use-toast';
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

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    blendy.toggle(`course-${course.id}`);
    setCourseDialogOpen(true);
  };

  const handleOpenNewCourse = () => {
    setEditingCourse(undefined);
    blendy.toggle('btn-add-course');
    setCourseDialogOpen(true);
  };

  const handleAddGradeClick = (course: Course) => {
    setSelectedCourse(course);
    blendy.toggle(`grade-${course.id}`);
    setGradeDialogOpen(true);
  };

  const handleCloseCourseDialog = () => {
    const key = editingCourse ? `course-${editingCourse.id}` : 'btn-add-course';
    blendy.untoggle(key, () => {
      setCourseDialogOpen(false);
      setEditingCourse(undefined);
    });
  };

  const handleCloseGradeDialog = () => {
    if (selectedCourse) {
      blendy.untoggle(`grade-${selectedCourse.id}`, () => {
        setGradeDialogOpen(false);
        setSelectedCourse(undefined);
      });
    } else {
      setGradeDialogOpen(false);
    }
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
      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-full sm:max-w-[400px]">
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <Tabs value={educationFilter} onValueChange={setEducationFilter} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="university">University</TabsTrigger>
                <TabsTrigger value="high_school">High School</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              data-blendy-from="btn-add-course"
              onClick={handleOpenNewCourse}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Course
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