'use client';

import React, { useState, useEffect } from 'react';

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

interface Course {
  id: string;
  name: string;
  code?: string;
  credits?: number;
  semester: string;
  year: number;
  professor?: string;
  color: string;
  finalGrade?: number;
  letterGrade?: string;
  educationType: string;
  grades: any[];
}

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
    setCourseDialogOpen(true);
  };

  const handleAddGradeClick = (course: Course) => {
    setSelectedCourse(course);
    setGradeDialogOpen(true);
  };

  // Calculate GPAs
  const overallGPA = calculateGPA(courses);
  const currentSemester = courses.length > 0
    ? `${courses[0].semester} ${courses[0].year}`
    : 'No semester';
  const currentSemesterCourses = courses.filter(
    c => c.semester === courses[0]?.semester && c.year === courses[0]?.year
  );
  const semesterGPA = calculateGPA(currentSemesterCourses.map(c => ({ ...c, credits: c.credits ?? 1 })));
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits ?? 0), 0);

  // Filtered courses
  const filteredCourses = educationFilter === 'all'
    ? courses
    : courses.filter(c => c.educationType === educationFilter);

  // Separate GPAs
  const universityCourses = courses.filter(c => c.educationType === 'university');
  const highSchoolCourses = courses.filter(c => c.educationType === 'high_school');
  const universityGPA = calculateGPA(universityCourses.map(c => ({ ...c, credits: c.credits ?? 1 })));
  const highSchoolGPA = calculateGPA(highSchoolCourses.map(c => ({ ...c, credits: c.credits ?? 1 })));

  if (loading) {
    return (
      <div>Loading...</div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">School</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Track your courses, grades, and GPA
        </p>
      </div>

      {/* GPA Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GPADisplay gpa={overallGPA} label="Overall GPA" />
        <GPADisplay gpa={universityGPA} label="University GPA" />
        <GPADisplay gpa={highSchoolGPA} label="High School GPA" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
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
              onClick={() => {
                setEditingCourse(undefined);
                setCourseDialogOpen(true);
              }}
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
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onEdit={handleEditCourse}
                  onDelete={handleDeleteCourse}
                  onAddGrade={handleAddGradeClick}
                />
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
        onClose={() => {
          setCourseDialogOpen(false);
          setEditingCourse(undefined);
        }}
        onSave={handleSaveCourse}
        course={editingCourse}
      />

      {selectedCourse && (
        <GradeDialog
          open={gradeDialogOpen}
          onClose={() => {
            setGradeDialogOpen(false);
            setSelectedCourse(undefined);
          }}
          onSave={handleAddGrade}
          courseId={selectedCourse.id}
        />
      )}
    </div>
  );
}